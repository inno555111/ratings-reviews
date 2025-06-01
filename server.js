const Database = require('better-sqlite3');
const db = new Database('database.db');

const express = require("express");
const bodyParser = require("body-parser");
const axios = require("axios");
const path = require("path");
const cors = require("cors");
const fs = require("fs");
require("dotenv").config();

const app = express();
const PORT = 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));

let accessToken = "";
let accessTokenExpiry = 0;

// ==== DATABASE TABLES INIT ====
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        message TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);
      
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT NOT NULL,
    password TEXT NOT NULL
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    song TEXT NOT NULL,
    artist TEXT NOT NULL,
    review TEXT,
    rating INTEGER NOT NULL,
    user_id INTEGER,
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`);
});

// ==== SPOTIFY TOKEN ====
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
setInterval(fetchSpotifyToken, 1000 * 60 * 60); // every hour

// ==== API ROUTES ====

// Token
app.get("/api/token", (req, res) => {
  res.json({ token: accessToken });
});

// Register
app.post("/api/register", (req, res) => {
  const { username, email, password } = req.body;

  db.run(
    "INSERT INTO users (username, email, password) VALUES (?, ?, ?)",
    [username, email, password],
    function (err) {
      if (err) {
        if (err.message.includes("UNIQUE constraint failed")) {
          return res.status(400).json({ error: "Korisničko ime već postoji" });
        }
        return res.status(500).json({ error: "Greška pri registraciji" });
      }
      res.json({ message: "Registracija uspješna", userId: this.lastID });
    }
  );
});

// Login
app.post("/api/login", (req, res) => {
  const { username, password } = req.body;

  db.get(
    "SELECT * FROM users WHERE (username = ? OR email = ?) AND password = ?",
    [username, username, password],
    (err, user) => {
      if (err) return res.status(500).json({ error: "Greška u bazi" });
      if (!user) return res.status(401).json({ error: "Nevažeći podaci" });

      res.json({ userId: user.id, username: user.username });
    }
  );
});

// Post review
app.post("/api/review", (req, res) => {
  const { song, artist, rating, review, user_id } = req.body;

  db.run(
    "INSERT INTO reviews (song, artist, review, rating, user_id) VALUES (?, ?, ?, ?, ?)",
    [song, artist, review, rating, user_id],
    function (err) {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: "Greška pri spremanju recenzije" });
      }
      res.json({ message: "Recenzija spremljena!" });
    }
  );
});

// Get reviews with username
app.get("/api/reviews", (req, res) => {
  const query = `
    SELECT reviews.*, users.username 
    FROM reviews 
    LEFT JOIN users ON reviews.user_id = users.id
    ORDER BY reviews.id DESC
  `;

  db.all(query, [], (err, rows) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "Greška pri dohvaćanju recenzija" });
    }
    res.json(rows);
  });
});

// Serve index.html
app.get("*", (req, res) => {
  const indexPath = path.join(__dirname, "public", "index.html");
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send("index.html not found");
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
app.post("/api/contact", (req, res) => {
    const { name, email, message } = req.body;
    if (!name || !email || !message) {
      return res.status(400).json({ error: "Sva polja su obavezna." });
    }
  
    db.run(
      `INSERT INTO messages (name, email, message) VALUES (?, ?, ?)`,
      [name, email, message],
      function (err) {
        if (err) {
          console.error("Greška pri spremanju poruke:", err);
          return res.status(500).json({ error: "Greška na serveru." });
        }
  
        res.json({ message: "Poruka uspješno poslana!" });
      }
    );
  });
  app.get("/api/stats", (req, res) => {
    const stats = {};
  
    db.get("SELECT COUNT(*) AS count FROM users", (err, row1) => {
      if (err) return res.status(500).json({ error: "Greška s korisnicima" });
      stats.users = row1.count;
  
      db.get("SELECT COUNT(*) AS count FROM reviews", (err, row2) => {
        if (err) return res.status(500).json({ error: "Greška s recenzijama" });
        stats.reviews = row2.count;
  
        db.get("SELECT COUNT(DISTINCT song) AS count FROM reviews", (err, row3) => {
          if (err) return res.status(500).json({ error: "Greška s pjesmama" });
          stats.songs = row3.count;
  
          res.json(stats);
        });
      });
    });
  });