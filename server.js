const express = require("express");
const bodyParser = require("body-parser");
const axios = require("axios");
const path = require("path");
const cors = require("cors");
const fs = require("fs");
const Database = require("better-sqlite3");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

// DB init
const db = new Database("./database.db");

db.prepare(`CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  email TEXT NOT NULL,
  password TEXT NOT NULL
)`).run();

db.prepare(`CREATE TABLE IF NOT EXISTS reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  song TEXT NOT NULL,
  artist TEXT NOT NULL,
  review TEXT,
  rating INTEGER NOT NULL,
  user_id INTEGER,
  FOREIGN KEY(user_id) REFERENCES users(id)
)`).run();

db.prepare(`CREATE TABLE IF NOT EXISTS contact_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  message TEXT NOT NULL
)`).run();

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));

// ===== SPOTIFY TOKEN HANDLING =====
let accessToken = "";
let accessTokenExpiry = 0;

async function fetchSpotifyToken() {
  const creds = Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString("base64");

  try {
    const response = await axios.post("https://accounts.spotify.com/api/token", "grant_type=client_credentials", {
      headers: {
        Authorization: `Basic ${creds}`,
        "Content-Type": "application/x-www-form-urlencoded"
      }
    });

    accessToken = response.data.access_token;
    accessTokenExpiry = Date.now() + response.data.expires_in * 1000;
    console.log("✅ Spotify token refreshed");
  } catch (err) {
    console.error("❌ Error fetching Spotify token:", err.response?.data || err.message);
  }
}

fetchSpotifyToken();
setInterval(fetchSpotifyToken, 1000 * 60 * 60);

// ===== ROUTES =====
app.get("/api/token", (req, res) => {
  res.json({ token: accessToken });
});

app.post("/api/register", (req, res) => {
  const { username, email, password } = req.body;

  try {
    db.prepare("INSERT INTO users (username, email, password) VALUES (?, ?, ?)").run(username, email, password);
    res.json({ message: "Registracija uspješna!" });
  } catch (err) {
    res.status(400).json({ error: "Korisničko ime već postoji!" });
  }
});

app.post("/api/login", (req, res) => {
  const { username, password } = req.body;
  const user = db.prepare("SELECT id, username FROM users WHERE (username = ? OR email = ?) AND password = ?")
                 .get(username, username, password);

  if (!user) return res.status(401).json({ error: "Nevažeći podaci" });
  res.json({ userId: user.id, username: user.username });
});

app.post("/api/review", (req, res) => {
  const { song, artist, review, rating, user_id } = req.body;

  try {
    db.prepare("INSERT INTO reviews (song, artist, review, rating, user_id) VALUES (?, ?, ?, ?, ?)")
      .run(song, artist, review, rating, user_id);
    res.json({ message: "Recenzija spremljena!" });
  } catch (err) {
    res.status(500).json({ error: "Greška pri spremanju recenzije." });
  }
});

app.get("/api/reviews", (req, res) => {
    const stmt = db.prepare(`
      SELECT reviews.*, users.username
      FROM reviews
      JOIN users ON users.id = reviews.user_id
      ORDER BY reviews.id DESC
    `);
    const reviews = stmt.all();
    res.json(reviews);
  });