// songs.js — trending list rendering, favorites persistence, audio attachment.
//
// Favorites live in IndexedDB (store: "favorites"), completely separate from
// data/trending-songs.json. That file is the only thing meant to be replaced
// on a weekly "update songs" command — favorites are never touched by it.

const DB_NAME = "clipdesk";
const DB_VERSION = 1;
const STORE = "favorites";

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx(storeMode) {
  const db = await openDB();
  return db.transaction(STORE, storeMode).objectStore(STORE);
}

export async function getFavorites() {
  const store = await tx("readonly");
  return new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

export async function saveFavorite(song) {
  const store = await tx("readwrite");
  return new Promise((resolve, reject) => {
    const req = store.put(song);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function removeFavorite(id) {
  const store = await tx("readwrite");
  return new Promise((resolve, reject) => {
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// In-memory attachment cache for non-favorited songs (session only —
// favoriting a song is what makes an attached file stick around).
const sessionAudio = new Map();

export async function loadTrendingList() {
  try {
    const res = await fetch("data/trending-songs.json", { cache: "no-store" });
    if (!res.ok) throw new Error("no trending file");
    const json = await res.json();
    return json.songs || [];
  } catch {
    return [];
  }
}

export class SongLibrary {
  constructor({ onUseSong, onToast }) {
    this.onUseSong = onUseSong;
    this.onToast = onToast || (() => {});
    this.trending = [];
    this.favorites = [];
  }

  async init() {
    this.trending = await loadTrendingList();
    this.favorites = await getFavorites();
    this.render();
  }

  isFavorite(id) {
    return this.favorites.some((f) => f.id === id);
  }

  getAudioFor(song) {
    if (song.audioBlob) return song.audioBlob;
    return sessionAudio.get(song.id) || null;
  }

  async attachAudio(song, file) {
    if (this.isFavorite(song.id)) {
      const fav = this.favorites.find((f) => f.id === song.id);
      fav.audioBlob = file;
      await saveFavorite(fav);
    } else {
      sessionAudio.set(song.id, file);
    }
    this.onToast(`Audio attached to "${song.title}"`);
    this.render();
  }

  async toggleFavorite(song) {
    if (this.isFavorite(song.id)) {
      await removeFavorite(song.id);
      this.favorites = this.favorites.filter((f) => f.id !== song.id);
      this.onToast(`Removed "${song.title}" from favorites`);
    } else {
      const audioBlob = this.getAudioFor(song) || null;
      const favSong = { ...song, audioBlob };
      await saveFavorite(favSong);
      this.favorites.push(favSong);
      this.onToast(`Saved "${song.title}" to favorites — won't be touched by weekly updates`);
    }
    this.render();
  }

  render() {
    this.renderList("songList", this.mergedTrending(), false);
    this.renderList("favoriteList", this.favorites, true);
  }

  // Trending list merged with favorite-attached audio, so a favorited
  // trending song shows its attached audio even after a weekly refresh.
  mergedTrending() {
    return this.trending.map((s) => {
      const fav = this.favorites.find((f) => f.id === s.id);
      return fav ? { ...s, audioBlob: fav.audioBlob } : s;
    });
  }

  renderList(containerId, list, isFavoritesTab) {
    const el = document.getElementById(containerId);
    el.innerHTML = "";

    if (list.length === 0) {
      const msg = isFavoritesTab
        ? "No favorites yet — star a track to keep it here for good."
        : "No songs loaded yet. Ask Claude to fetch this week's trending list.";
      el.innerHTML = `<div class="empty-note">${msg}</div>`;
      return;
    }

    list.forEach((song) => {
      const card = document.createElement("div");
      card.className = "song-card";
      const fav = this.isFavorite(song.id);
      const hasAudio = !!this.getAudioFor(song);

      card.innerHTML = `
        <div class="song-card-top">
          <div>
            <div class="song-title"></div>
            <div class="song-artist"></div>
            ${song.tag ? `<span class="song-tag">${escapeHtml(song.tag)}</span>` : ""}
          </div>
          <button class="star-btn ${fav ? "active" : ""}" title="Favorite">${fav ? "★" : "☆"}</button>
        </div>
        <div class="song-card-actions">
          <button class="btn btn-small use-btn" ${hasAudio ? "" : "disabled"}>${hasAudio ? "Use in editor" : "No audio yet"}</button>
          <label class="btn btn-small attach-btn">Attach<input type="file" accept="audio/*" hidden></label>
        </div>
      `;
      card.querySelector(".song-title").textContent = song.title;
      card.querySelector(".song-artist").textContent = song.artist || "";

      card.querySelector(".star-btn").addEventListener("click", () => this.toggleFavorite(song));
      card.querySelector(".use-btn").addEventListener("click", () => {
        const blob = this.getAudioFor(song);
        if (blob) this.onUseSong(song, blob);
      });
      card.querySelector(".attach-btn input").addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (file) this.attachAudio(song, file);
      });

      el.appendChild(card);
    });
  }
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
