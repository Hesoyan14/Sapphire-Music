const tracksList = document.getElementById("tracksList");
const queueList = document.getElementById("queueList");
const uploadForm = document.getElementById("uploadForm");
const fileInput = document.getElementById("fileInput");
const audioPlayer = document.getElementById("audioPlayer");
const playPauseBtn = document.getElementById("playPauseBtn");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const seekBar = document.getElementById("seekBar");
const nowTitle = document.getElementById("nowTitle");
const nowArtist = document.getElementById("nowArtist");
const currentTime = document.getElementById("currentTime");
const totalTime = document.getElementById("totalTime");
const volumeBtn = document.getElementById("volumeBtn");
const volumePanel = document.getElementById("volumePanel");
const volumeRange = document.getElementById("volumeRange");
const searchInput = document.getElementById("searchInput");
const categoryItems = document.querySelectorAll(".category-item");
const mainView = document.getElementById("mainView");
const playlistsView = document.getElementById("playlistsView");
const playlistsGrid = document.getElementById("playlistsGrid");
const createPlaylistBtn = document.getElementById("createPlaylistBtn");
const trackMenu = document.getElementById("trackMenu");
const menuAddToQueue = document.getElementById("menuAddToQueue");
const menuPlaylists = document.getElementById("menuPlaylists");

let tracks = [];
let queue = [];
let playlists = [];
let currentQueueIndex = -1;
let searchQuery = "";
let typingTimer = null;
let activeTrackMenuId = null;
let currentView = "main";
let draggedQueueItemId = null;
const FALLBACK_COVER =
  "data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80'%3E%3Crect width='100%25' height='100%25' fill='%23141414'/%3E%3Cpath d='M18 20h44v40H18z' fill='none' stroke='%23666' stroke-width='2'/%3E%3Ccircle cx='48' cy='52' r='8' fill='none' stroke='%23666' stroke-width='2'/%3E%3Cpath d='M34 30v22a7 7 0 1 0 2 5V36h14v16a7 7 0 1 0 2 5V30z' fill='%23666'/%3E%3C/svg%3E";

function setPlayButtonState(isPlaying) {
  playPauseBtn.classList.toggle("is-pause", isPlaying);
  playPauseBtn.classList.toggle("is-play", !isPlaying);
}

function updateVolume(value) {
  const normalized = Math.max(0, Math.min(100, Number(value)));
  audioPlayer.volume = normalized / 100;
  volumeRange.value = String(normalized);
}

function updateElementCursorGlow(element, clientX, clientY) {
  const rect = element.getBoundingClientRect();
  const x = clientX - rect.left;
  const y = clientY - rect.top;
  element.style.setProperty("--mx", `${x}px`);
  element.style.setProperty("--my", `${y}px`);
}

function updateProximityGlow(clientX, clientY) {
  const elements = document.querySelectorAll(".cursor-reactive");
  elements.forEach((element) => {
    const rect = element.getBoundingClientRect();
    const proximity = 70;
    const inRangeX = clientX >= rect.left - proximity && clientX <= rect.right + proximity;
    const inRangeY = clientY >= rect.top - proximity && clientY <= rect.bottom + proximity;

    if (!inRangeX || !inRangeY) {
      element.style.setProperty("--near-opacity", "0");
      return;
    }

    updateElementCursorGlow(element, clientX, clientY);

    const dx = clientX < rect.left ? rect.left - clientX : clientX > rect.right ? clientX - rect.right : 0;
    const dy = clientY < rect.top ? rect.top - clientY : clientY > rect.bottom ? clientY - rect.bottom : 0;
    const distance = Math.hypot(dx, dy);
    const strength = Math.max(0, 1 - distance / proximity);
    element.style.setProperty("--near-opacity", `${0.15 + strength * 0.85}`);
  });
}

function initCursorReactiveElements() {
  document.querySelectorAll(".player-btn, .panel, .track-item, .topbar, .player-bar, #searchInput, #fileInput, .upload-btn, .category-item, .playlist-card").forEach((element) => {
    element.classList.add("cursor-reactive");
  });

  // Dynamic list buttons are added after initial render.
  document.querySelectorAll(".actions .icon-btn").forEach((element) => {
    element.classList.add("cursor-reactive");
  });
}

function onUiUpdated() {
  initCursorReactiveElements();
}

function filteredTracks() {
  if (!searchQuery) return tracks;
  return tracks.filter((track) => {
    const blob = `${track.title} ${track.artist} ${track.original_filename || ""}`.toLowerCase();
    return blob.includes(searchQuery);
  });
}

function renderTracks() {
  tracksList.innerHTML = "";
  const visibleTracks = filteredTracks();
  if (!visibleTracks.length) {
    tracksList.innerHTML = `<div class="meta">${tracks.length ? "Nothing found for this query." : "No tracks uploaded yet."}</div>`;
    onUiUpdated();
    return;
  }

  visibleTracks.forEach((track) => {
    const row = document.createElement("div");
    row.className = "track-item cursor-reactive";
    row.innerHTML = `
      <img class="track-cover" src="${track.cover_url || FALLBACK_COVER}" alt="" loading="lazy" onerror="this.src='${FALLBACK_COVER}'" />
      <div class="track-main" data-play-track="${track.id}">
        <div class="title">${track.title}</div>
        <div class="meta">${track.artist} • ${track.duration_label}</div>
      </div>
      <div class="actions">
        <button class="icon-btn cursor-reactive" data-add="${track.id}" title="Add to queue" aria-label="Add to queue">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5h2v14h-2zM5 11h14v2H5z"></path></svg>
        </button>
        <button class="ghost icon-btn cursor-reactive" data-delete-track="${track.id}" title="Delete track" aria-label="Delete track">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 3h6l1 2h4v2H4V5h4zm-2 6h10l-1 11H8z"></path></svg>
        </button>
        <button class="ghost icon-btn cursor-reactive track-menu-btn" data-menu-track="${track.id}" title="Options" aria-label="Options">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 10a2 2 0 1 0 2 2 2 2 0 0 0-2-2zm6 0a2 2 0 1 0 2 2 2 2 0 0 0-2-2zm6 0a2 2 0 1 0 2 2 2 2 0 0 0-2-2z"></path></svg>
        </button>
      </div>
    `;
    tracksList.appendChild(row);
  });
  onUiUpdated();
}

function renderQueue() {
  queueList.innerHTML = "";
  if (!queue.length) {
    queueList.innerHTML = `<div class="meta">Queue is empty.</div>`;
    onUiUpdated();
    return;
  }

  queue.forEach((item, index) => {
    const row = document.createElement("div");
    row.className = "track-item cursor-reactive";
    row.draggable = true;
    row.dataset.queueItemId = item.queue_item_id;
    const active = currentQueueIndex === index ? "style='color:#1DB954'" : "";
    row.innerHTML = `
      <img class="track-cover" src="${item.cover_url || FALLBACK_COVER}" alt="" loading="lazy" onerror="this.src='${FALLBACK_COVER}'" />
      <div class="track-main" data-play-queue="${index}">
        <div class="title" ${active}>${item.title}</div>
        <div class="meta">${item.artist}</div>
      </div>
      <div class="actions">
        <button class="ghost icon-btn cursor-reactive" data-remove="${item.queue_item_id}" title="Remove" aria-label="Remove">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 7h12v2H6zm2 3h8l-1 9H9zm2-5h4l1 1h4v2H5V6h4z"></path></svg>
        </button>
      </div>
    `;
    queueList.appendChild(row);
  });
  onUiUpdated();
}

function clearQueueDropTargets() {
  queueList.querySelectorAll(".drop-target").forEach((row) => row.classList.remove("drop-target"));
}

function reorderQueueByIds(sourceId, targetId, insertAfter) {
  const sourceIndex = queue.findIndex((item) => item.queue_item_id === sourceId);
  const targetIndex = queue.findIndex((item) => item.queue_item_id === targetId);
  if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return;

  const [moved] = queue.splice(sourceIndex, 1);
  let nextIndex = targetIndex;
  if (sourceIndex < targetIndex) nextIndex -= 1;
  if (insertAfter) nextIndex += 1;
  queue.splice(nextIndex, 0, moved);
}

async function persistQueueOrder() {
  const response = await fetch("/queue", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "replace", queue }),
  });
  if (response.ok) {
    queue = await response.json();
    localStorage.setItem("music_queue", JSON.stringify(queue));
    renderQueue();
  }
}

function renderPlaylists() {
  playlistsGrid.innerHTML = "";
  const createCard = document.createElement("button");
  createCard.className = "playlist-card cursor-reactive";
  createCard.type = "button";
  createCard.innerHTML = `
    <div class="playlist-cover" style="display:flex;align-items:center;justify-content:center;font-size:2rem;color:#9a9a9a;">+</div>
    <div class="playlist-name">Новый плейлист</div>
  `;
  createCard.addEventListener("click", () => createPlaylistBtn.click());
  playlistsGrid.appendChild(createCard);

  playlists.forEach((playlist) => {
    const card = document.createElement("div");
    card.className = "playlist-card cursor-reactive";
    card.innerHTML = `
      <button class="icon-btn ghost playlist-delete-btn cursor-reactive" data-delete-playlist="${playlist.id}" title="Удалить плейлист" aria-label="Удалить плейлист">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 3h6l1 2h4v2H4V5h4zm-2 6h10l-1 11H8z"></path></svg>
      </button>
      <img class="playlist-cover" src="${playlist.cover_url || FALLBACK_COVER}" alt="" onerror="this.src='${FALLBACK_COVER}'" />
      <div class="playlist-name">${playlist.name}</div>
    `;
    card.addEventListener("click", (event) => {
      const deleteBtn = event.target.closest("[data-delete-playlist]");
      if (deleteBtn) return;
      openPlaylist(playlist);
    });
    playlistsGrid.appendChild(card);
  });
  onUiUpdated();
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return "0:00";
  const s = Math.floor(seconds);
  const minutes = Math.floor(s / 60);
  const remainder = s % 60;
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

async function fetchTracks() {
  const response = await fetch("/tracks");
  tracks = await response.json();
  renderTracks();
}

async function fetchQueue() {
  const response = await fetch("/queue");
  queue = await response.json();
  renderQueue();
}

async function fetchPlaylists() {
  const response = await fetch("/playlists");
  playlists = await response.json();
  renderPlaylists();
}

async function addToQueue(trackId) {
  const response = await fetch("/queue", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "add", track_id: trackId }),
  });
  queue = await response.json();
  localStorage.setItem("music_queue", JSON.stringify(queue));
  renderQueue();
}

async function removeFromQueue(queueItemId) {
  const response = await fetch("/queue", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "remove", queue_item_id: queueItemId }),
  });
  queue = await response.json();
  localStorage.setItem("music_queue", JSON.stringify(queue));
  if (currentQueueIndex >= queue.length) currentQueueIndex = queue.length - 1;
  renderQueue();
}

async function deleteTrack(trackId) {
  const response = await fetch(`/tracks/${trackId}`, { method: "DELETE" });
  const payload = await response.json();
  if (!response.ok) {
    alert(payload.error || "Failed to delete track");
    return;
  }

  const deletedWasCurrent =
    currentQueueIndex >= 0 &&
    queue[currentQueueIndex] &&
    queue[currentQueueIndex].id === trackId;

  if (deletedWasCurrent) {
    audioPlayer.pause();
    audioPlayer.removeAttribute("src");
    audioPlayer.load();
    currentQueueIndex = -1;
    setNowPlaying(null);
    setPlayButtonState(false);
  }

  queue = payload.queue || [];
  playlists = payload.playlists || playlists;
  localStorage.setItem("music_queue", JSON.stringify(queue));
  await fetchTracks();
  renderQueue();
  renderPlaylists();
}

async function createPlaylist() {
  const name = window.prompt("Название плейлиста:");
  if (!name || !name.trim()) return;
  const response = await fetch("/playlists", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: name.trim() }),
  });
  const payload = await response.json();
  if (!response.ok) {
    alert(payload.error || "Failed to create playlist");
    return;
  }
  playlists.push(payload);
  renderPlaylists();
}

async function deletePlaylist(playlistId) {
  const response = await fetch(`/playlists/${playlistId}`, { method: "DELETE" });
  const payload = await response.json();
  if (!response.ok) {
    alert(payload.error || "Failed to delete playlist");
    return;
  }
  playlists = payload.playlists || [];
  renderPlaylists();
}

async function addTrackToPlaylist(playlistId, trackId) {
  const response = await fetch(`/playlists/${playlistId}/tracks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ track_id: trackId }),
  });
  const updated = await response.json();
  if (!response.ok) {
    alert(updated.error || "Failed to add track");
    return;
  }
  playlists = playlists.map((item) => (item.id === playlistId ? updated : item));
  hideTrackMenu();
  renderPlaylists();
}

async function openPlaylist(playlist) {
  const playlistTracks = Array.isArray(playlist.tracks) ? playlist.tracks : [];
  if (!playlistTracks.length) {
    alert("Плейлист пуст.");
    return;
  }

  const preparedQueue = playlistTracks.map((track) => ({
    ...track,
    queue_item_id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}_${Math.random()}`,
  }));

  const response = await fetch("/queue", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "replace", queue: preparedQueue }),
  });

  if (!response.ok) {
    alert("Не удалось открыть плейлист.");
    return;
  }

  queue = await response.json();
  localStorage.setItem("music_queue", JSON.stringify(queue));
  renderQueue();
  setView("main");
}

function renderTrackMenu(trackId) {
  activeTrackMenuId = trackId;
  menuPlaylists.innerHTML = "";

  if (!playlists.length) {
    menuPlaylists.innerHTML = `<div class="meta">Сначала создайте плейлист в разделе Playlists.</div>`;
  } else {
    playlists.forEach((playlist) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = playlist.name;
      btn.addEventListener("click", (event) => {
        event.stopPropagation();
        addTrackToPlaylist(playlist.id, trackId);
      });
      menuPlaylists.appendChild(btn);
    });
  }
}

function showTrackMenu(trackId, anchor) {
  renderTrackMenu(trackId);
  const rect = anchor.getBoundingClientRect();
  trackMenu.style.left = `${Math.max(8, rect.right - 220)}px`;
  trackMenu.style.top = `${rect.bottom + 8}px`;
  trackMenu.classList.remove("is-hidden");
}

function hideTrackMenu() {
  trackMenu.classList.add("is-hidden");
  activeTrackMenuId = null;
}

function setView(viewName) {
  currentView = viewName;
  categoryItems.forEach((item) => item.classList.toggle("is-active", item.dataset.view === viewName));
  const showPlaylists = viewName === "playlists";
  mainView.classList.toggle("is-hidden", showPlaylists);
  playlistsView.classList.toggle("is-hidden", !showPlaylists);
}

function setNowPlaying(track) {
  nowTitle.textContent = track?.title || "No track selected";
  nowArtist.textContent = track?.artist || "-";
}

function playQueueIndex(index) {
  if (!queue.length || index < 0 || index >= queue.length) return;
  currentQueueIndex = index;
  const track = queue[index];
  audioPlayer.src = track.audio_url;
  audioPlayer.play();
  setPlayButtonState(true);
  setNowPlaying(track);
  renderQueue();
}

function playNext() {
  if (!queue.length) return;
  const nextIndex = currentQueueIndex + 1;
  if (nextIndex < queue.length) {
    playQueueIndex(nextIndex);
  } else {
    currentQueueIndex = -1;
    setPlayButtonState(false);
    setNowPlaying(null);
  }
}

function playPrevious() {
  if (!queue.length) return;
  const prevIndex = currentQueueIndex - 1;
  if (prevIndex >= 0) playQueueIndex(prevIndex);
}

uploadForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const file = fileInput.files[0];
  if (!file) return;

  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch("/upload", {
    method: "POST",
    body: formData,
  });
  const payload = await response.json();

  if (!response.ok) {
    alert(payload.error || "Upload failed");
    return;
  }

  fileInput.value = "";
  await fetchTracks();
});

searchInput.addEventListener("input", () => {
  searchQuery = searchInput.value.trim().toLowerCase();
  searchInput.classList.add("is-typing");
  if (typingTimer) clearTimeout(typingTimer);
  typingTimer = setTimeout(() => searchInput.classList.remove("is-typing"), 260);
  renderTracks();
});

tracksList.addEventListener("click", (event) => {
  const trackMain = event.target.closest("[data-play-track]");
  if (trackMain) {
    const trackId = trackMain.getAttribute("data-play-track");
    const track = tracks.find((item) => item.id === trackId);
    if (!track) return;
    const existingQueueIndex = queue.findIndex((item) => item.id === track.id);
    if (existingQueueIndex >= 0) {
      playQueueIndex(existingQueueIndex);
    } else {
      addToQueue(track.id).then(() => playQueueIndex(queue.length - 1));
    }
    return;
  }

  const button = event.target.closest("button");
  if (!button) return;
  const addId = button.getAttribute("data-add");
  const deleteId = button.getAttribute("data-delete-track");
  const menuTrackId = button.getAttribute("data-menu-track");
  if (addId) addToQueue(addId);
  if (deleteId) {
    deleteTrack(deleteId);
    return;
  }
  if (menuTrackId) {
    event.stopPropagation();
    showTrackMenu(menuTrackId, button);
    return;
  }
});

queueList.addEventListener("click", (event) => {
  const queueMain = event.target.closest("[data-play-queue]");
  if (queueMain) {
    playQueueIndex(Number(queueMain.getAttribute("data-play-queue")));
    return;
  }

  const button = event.target.closest("button");
  if (!button) return;
  const removeId = button.getAttribute("data-remove");
  if (removeId) removeFromQueue(removeId);
});

queueList.addEventListener("dragstart", (event) => {
  const row = event.target.closest(".track-item");
  if (!row) return;
  draggedQueueItemId = row.dataset.queueItemId;
  row.classList.add("dragging");
  event.dataTransfer.effectAllowed = "move";
});

queueList.addEventListener("dragover", (event) => {
  event.preventDefault();
  clearQueueDropTargets();
  const row = event.target.closest(".track-item");
  if (row) row.classList.add("drop-target");
});

queueList.addEventListener("dragleave", (event) => {
  const row = event.target.closest(".track-item");
  if (row) row.classList.remove("drop-target");
});

queueList.addEventListener("drop", async (event) => {
  event.preventDefault();
  const targetRow = event.target.closest(".track-item");
  if (!targetRow || !draggedQueueItemId) return;
  const targetId = targetRow.dataset.queueItemId;
  if (!targetId || targetId === draggedQueueItemId) return;

  const rect = targetRow.getBoundingClientRect();
  const insertAfter = event.clientY > rect.top + rect.height / 2;
  reorderQueueByIds(draggedQueueItemId, targetId, insertAfter);
  await persistQueueOrder();
  clearQueueDropTargets();
});

queueList.addEventListener("dragend", () => {
  draggedQueueItemId = null;
  queueList.querySelectorAll(".dragging").forEach((row) => row.classList.remove("dragging"));
  clearQueueDropTargets();
});

playPauseBtn.addEventListener("click", () => {
  if (!audioPlayer.src && queue.length) {
    playQueueIndex(0);
    return;
  }

  if (audioPlayer.paused) {
    audioPlayer.play();
    setPlayButtonState(true);
  } else {
    audioPlayer.pause();
    setPlayButtonState(false);
  }
});

volumeBtn.addEventListener("click", (event) => {
  event.stopPropagation();
  volumePanel.classList.toggle("open");
  volumePanel.setAttribute("aria-hidden", volumePanel.classList.contains("open") ? "false" : "true");
});

volumePanel.addEventListener("click", (event) => {
  event.stopPropagation();
});

volumeRange.addEventListener("input", () => {
  updateVolume(volumeRange.value);
});

document.addEventListener("click", () => {
  volumePanel.classList.remove("open");
  volumePanel.setAttribute("aria-hidden", "true");
  hideTrackMenu();
});

trackMenu.addEventListener("click", (event) => event.stopPropagation());

menuAddToQueue.addEventListener("click", () => {
  if (!activeTrackMenuId) return;
  addToQueue(activeTrackMenuId);
  hideTrackMenu();
});

categoryItems.forEach((item) => {
  item.addEventListener("click", () => {
    const view = item.dataset.view || "main";
    setView(view);
  });
});

createPlaylistBtn.addEventListener("click", createPlaylist);

playlistsGrid.addEventListener("click", (event) => {
  const button = event.target.closest("[data-delete-playlist]");
  if (!button) return;
  event.stopPropagation();
  deletePlaylist(button.getAttribute("data-delete-playlist"));
});

nextBtn.addEventListener("click", playNext);
prevBtn.addEventListener("click", playPrevious);

audioPlayer.addEventListener("loadedmetadata", () => {
  seekBar.max = Math.floor(audioPlayer.duration || 0);
  totalTime.textContent = formatTime(audioPlayer.duration || 0);
});

audioPlayer.addEventListener("timeupdate", () => {
  seekBar.value = Math.floor(audioPlayer.currentTime || 0);
  currentTime.textContent = formatTime(audioPlayer.currentTime || 0);
});

seekBar.addEventListener("input", () => {
  audioPlayer.currentTime = Number(seekBar.value);
});

audioPlayer.addEventListener("ended", () => {
  playNext();
});

audioPlayer.addEventListener("play", () => setPlayButtonState(true));
audioPlayer.addEventListener("pause", () => setPlayButtonState(false));

window.addEventListener("DOMContentLoaded", async () => {
  await fetchTracks();
  await fetchQueue();
  await fetchPlaylists();

  const localQueue = localStorage.getItem("music_queue");
  if (localQueue && !queue.length) {
    try {
      const parsed = JSON.parse(localQueue);
      if (Array.isArray(parsed) && parsed.length) {
        await fetch("/queue", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "replace", queue: parsed }),
        });
        await fetchQueue();
      }
    } catch (_error) {
      // Ignore broken localStorage payloads.
    }
  }
  setPlayButtonState(false);
  updateVolume(70);
  setView("main");
});

window.addEventListener("mousemove", (event) => {
  updateProximityGlow(event.clientX, event.clientY);
});

window.addEventListener("DOMContentLoaded", () => {
  initCursorReactiveElements();
});
