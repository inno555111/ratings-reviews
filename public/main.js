let token = "", selectedSong = "", selectedArtist = "";
const currentUser = JSON.parse(localStorage.getItem("user") || "null");

// ================= TOKEN =================
fetch("/api/token")
  .then(res => res.json())
  .then(data => {
    token = data.token;
    routeInit(); // start page-specific code
  });

// ================= PAGE ROUTER =================
function routeInit() {
  const path = window.location.pathname;

  if (path.endsWith("index.html") || path === "/") {
    loadAlbums();
  }

  if (path.endsWith("profile.html")) {
    renderAuth();
  }

  if (path.endsWith("reviews.html")) {
    loadReviews();
  }
}

// ================= ALBUMS (index) =================
function loadAlbums() {
  fetch("https://api.spotify.com/v1/browse/new-releases?limit=16", {
    headers: { Authorization: "Bearer " + token }
  })
    .then(res => res.json())
    .then(data => {
      const box = document.getElementById("viralAlbums");
      if (!box) return;
      box.innerHTML = "";
      data.albums.items.forEach(album => {
        const div = document.createElement("div");
        div.className = "album-card";
        const releaseYear = album.release_date ? album.release_date.split("-")[0] : "";
        const type = album.album_type.charAt(0).toUpperCase() + album.album_type.slice(1);
        div.innerHTML = `
          <img src="${album.images[0].url}" />
          <h4>${album.name}</h4>
          <p>${album.artists[0].name}</p>
          <small style="color:#ccc;">${type} – ${releaseYear}</small><br/>
          <button>Ocijeni</button>
        `;
        const btn = div.querySelector("button");
        btn.addEventListener("click", () => openAlbumPopup(album.id, album.name));
        box.appendChild(div);
      });
    });
}

// ================== REVIEWS ==================
function loadReviews() {
  fetch("/api/reviews")
    .then(res => res.json())
    .then(data => {
      const list = document.getElementById("reviewList");
      if (!list) return;
      list.innerHTML = "";
      data.forEach(r => {
        const box = document.createElement("div");
        box.className = "review-box";
        box.innerHTML = `
          <h4>${r.song} – ${r.artist}</h4>
          <p><strong>Ocjena:</strong> ${r.rating}/10</p>
          <p>${r.review}</p>
          <em>Autor: ${r.username}</em>
        `;
        list.appendChild(box);
      });
    });
}

// ================== AUTH ==================
function renderAuth() {
  const container = document.getElementById("authContainer");
  if (!container) return;

  if (!currentUser) {
    container.innerHTML = `
      <h3>Prijava</h3>
      <input id="loginUser" placeholder="Korisničko ime ili email" />
      <input id="loginPass" placeholder="Lozinka" type="password" />
      <button onclick="login()">Prijavi se</button>

      <h3>Registracija</h3>
      <input id="regUser" placeholder="Korisničko ime" />
      <input id="regMail" placeholder="Email" />
      <input id="regPass" placeholder="Lozinka" type="password" />
      <button onclick="register()">Registriraj se</button>
    `;
  } else {
    container.innerHTML = `<h3>Dobrodošao, ${currentUser.username}!</h3><button onclick="logout()">Odjava</button>`;
  }
}

function login() {
  const u = document.getElementById("loginUser").value;
  const p = document.getElementById("loginPass").value;
  fetch("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: u, password: p })
  })
    .then(res => res.json())
    .then(data => {
      if (data.error) return alert(data.error);
      localStorage.setItem("user", JSON.stringify({ id: data.userId, username: data.username }));
      location.reload();
    });
}

function register() {
  const username = document.getElementById("regUser").value;
  const email = document.getElementById("regMail").value;
  const password = document.getElementById("regPass").value;
  fetch("/api/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, email, password })
  })
    .then(res => res.json())
    .then(data => {
      if (data.error) return alert(data.error);
      alert("Registracija uspješna!");
    });
}

function logout() {
  localStorage.removeItem("user");
  location.reload();
}

// ================ POPUP ZA OCJENE ALBUMA I PJESAMA ================
function openAlbumPopup(albumId, albumName) {
  const overlay = document.getElementById("albumPopupOverlay");
  const title = document.getElementById("albumPopupTitle");
  const list = document.getElementById("albumTracksList");
  if (!overlay || !title || !list) return;

  title.innerText = `Ocijeni pjesme iz albuma: ${albumName}`;
  overlay.style.display = "flex";
  list.innerHTML = "<p>Učitavanje pjesama...</p>";

  fetch(`https://api.spotify.com/v1/albums/${albumId}`, {
    headers: { Authorization: "Bearer " + token }
  })
    .then(res => res.json())
    .then(album => {
      list.innerHTML = "";
      album.tracks.items.forEach(track => {
        const div = document.createElement("div");
        div.className = "track-item";
        div.innerHTML = `
          <strong>${track.name}</strong>
          <button onclick="openPopup('${track.name.replace(/'/g, "\\'")}', '${album.artists[0].name.replace(/'/g, "\\'")}')">Ocijeni</button>
        `;
        list.appendChild(div);
      });
    });
}

function closeAlbumPopup() {
  const overlay = document.getElementById("albumPopupOverlay");
  if (overlay) overlay.style.display = "none";
}

function openPopup(song, artist) {
  selectedSong = song;
  selectedArtist = artist;
  const overlay = document.getElementById("popupOverlay");
  const title = document.getElementById("popupTitle");
  if (overlay && title) {
    title.innerText = `${song} – ${artist}`;
    overlay.style.display = "flex";
  }
}

function closePopup() {
  const overlay = document.getElementById("popupOverlay");
  if (overlay) overlay.style.display = "none";
}

function submitPopup() {
  const review = document.getElementById("popupReview").value;
  const rating = document.getElementById("popupRating").value;

  fetch("/api/review", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      song: selectedSong,
      artist: selectedArtist,
      review,
      rating,
      user_id: currentUser?.id
    })
  })
    .then(res => res.json())
    .then(data => {
      alert(data.message);
      closePopup();
      loadReviews();
    });
}
document.addEventListener("DOMContentLoaded", () => {
  const contactForm = document.querySelector("#contact form");
  if (contactForm) {
    contactForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const name = contactForm.querySelector("input[name='name']").value.trim();
      const email = contactForm.querySelector("input[name='email']").value.trim();
      const message = contactForm.querySelector("textarea[name='message']").value.trim();

      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, message })
      });

      const result = await response.json();
      if (result.error) {
        alert("Greška: " + result.error);
      } else {
        alert("Poruka poslana!");
        contactForm.reset();
      }
    });
  }
});
function loadStats() {
  fetch("/api/stats")
    .then(res => res.json())
    .then(data => {
      document.getElementById("stat-users").textContent = data.users;
      document.getElementById("stat-reviews").textContent = data.reviews;
      document.getElementById("stat-songs").textContent = data.songs;
    });
}

document.addEventListener("DOMContentLoaded", loadStats);
window.searchSpotify = function () {
  const query = document.getElementById("searchInput").value.trim();
  if (!query) return;

  const results = document.getElementById("searchResults");
  results.innerHTML = "<p>Pretražujem...</p>";

  Promise.all([
    fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=6`, {
      headers: { Authorization: "Bearer " + token }
    }).then(res => res.json()),

    fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=album&limit=6`, {
      headers: { Authorization: "Bearer " + token }
    }).then(res => res.json())
  ])
    .then(([trackData, albumData]) => {
      results.innerHTML = "";
      const combined = [];

      if (trackData.tracks?.items?.length) {
        trackData.tracks.items.forEach(track => {
          combined.push({
            kind: "song",
            type: "Song",
            name: track.name,
            artist: track.artists[0].name,
            image: track.album.images[0]?.url,
          });
        });
      }

      if (albumData.albums?.items?.length) {
        albumData.albums.items.forEach(album => {
          combined.push({
            kind: "album",
            type: album.album_type.charAt(0).toUpperCase() + album.album_type.slice(1),
            name: album.name,
            artist: album.artists[0].name,
            image: album.images[0]?.url,
            id: album.id
          });
        });
      }

      if (!combined.length) {
        results.innerHTML = "<p>Nema rezultata.</p>";
        return;
      }

      combined.forEach(item => {
        const div = document.createElement("div");
        div.className = "album-card";
        div.innerHTML = `
          <img src="${item.image || ''}" />
          <h4>${item.name}</h4>
          <p>${item.artist}</p>
          <small style="color:#ccc;">${item.type}</small><br/>
          <button>Ocijeni</button>
        `;

        const btn = div.querySelector("button");
        if (item.kind === "song") {
          btn.addEventListener("click", () => openPopup(item.name, item.artist));
        } else if (item.kind === "album") {
          btn.addEventListener("click", () => openAlbumPopup(item.id, item.name));
        }

        results.appendChild(div);
      });
    })
    .catch(err => {
      console.error("Greška pri dohvaćanju rezultata:", err);
      results.innerHTML = "<p>Greška pri dohvaćanju rezultata.</p>";
    });
};
window.openPopup = openPopup;
window.openAlbumPopup = openAlbumPopup;