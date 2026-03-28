const tracksList = document.getElementById("tracksList");
const queueList = document.getElementById("queueList");
const uploadForm = document.getElementById("uploadForm");
const themeToggleBtn = document.getElementById("themeToggleBtn");
const uploadIconBtn = document.getElementById("uploadIconBtn");
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
const likesView = document.getElementById("likesView");
const likesList = document.getElementById("likesList");
const likesCountEl = document.getElementById("likesCount");
const likesCountLabelEl = document.getElementById("likesCountLabel");
const playlistsView = document.getElementById("playlistsView");
const settingsView = document.getElementById("settingsView");
const playlistsGrid = document.getElementById("playlistsGrid");
const playlistsBrowse = document.getElementById("playlistsBrowse");
const playlistDetailPanel = document.getElementById("playlistDetailPanel");
const playlistDetailBack = document.getElementById("playlistDetailBack");
const playlistPlayAllBtn = document.getElementById("playlistPlayAllBtn");
const playlistDetailCover = document.getElementById("playlistDetailCover");
const playlistDetailTitle = document.getElementById("playlistDetailTitle");
const playlistDetailMeta = document.getElementById("playlistDetailMeta");
const playlistDetailList = document.getElementById("playlistDetailList");
const createPlaylistBtn = document.getElementById("createPlaylistBtn");
const trackHighlightColorInput = document.getElementById("trackHighlightColor");
const trackHighlightHexInput = document.getElementById("trackHighlightHex");
const playerGlowToggle = document.getElementById("playerGlowToggle");
const topbarGlowToggle = document.getElementById("topbarGlowToggle");
const topbarOutlineToggle = document.getElementById("topbarOutlineToggle");
const trackMenu = document.getElementById("trackMenu");
const menuTrackDetails = document.getElementById("menuTrackDetails");
const menuAddToQueue = document.getElementById("menuAddToQueue");
const menuDeleteTrack = document.getElementById("menuDeleteTrack");
const menuRemoveFromPlaylist = document.getElementById("menuRemoveFromPlaylist");
const menuPlaylists = document.getElementById("menuPlaylists");
const trackBeatGlowToggle = document.getElementById("trackBeatGlowToggle");
const trackDetailsModal = document.getElementById("trackDetailsModal");
const trackDetailsBody = document.getElementById("trackDetailsBody");
const trackDetailsBackdrop = document.getElementById("trackDetailsBackdrop");
const trackDetailsClose = document.getElementById("trackDetailsClose");
const trackDetailsOk = document.getElementById("trackDetailsOk");
const authModal = document.getElementById("authModal");
const authForm = document.getElementById("authForm");
const loginUsername = document.getElementById("loginUsername");
const loginPassword = document.getElementById("loginPassword");
const loginError = document.getElementById("loginError");
const loginSubmit = document.getElementById("loginSubmit");
const loginPasswordToggle = document.getElementById("loginPasswordToggle");
const logoutBtn = document.getElementById("logoutBtn");

let tracks = [];
let queue = [];
let playlists = [];
let currentQueueIndex = -1;
let selectedTrackId = null;
let searchQuery = "";
let typingTimer = null;
let activeTrackMenuId = null;
let currentView = "main";
let openedPlaylistId = null;
let draggedQueueItemId = null;

let beatAudioCtx = null;
let beatAnalyser = null;
let beatSourceNode = null;
let beatFreqData = null;
let beatAudioGraphReady = false;
let beatAudioGraphFailed = false;
let beatGlowRafId = 0;
let beatPrevBass = 0;
let beatSmoothed = 0;
const FAVORITES_KEY = "sapphire_favorites";
const TRACK_HIGHLIGHT_KEY = "sapphire_track_highlight";
const PLAYER_GLOW_KEY = "sapphire_player_glow";
const TOPBAR_GLOW_KEY = "sapphire_topbar_glow";
const TOPBAR_OUTLINE_KEY = "sapphire_topbar_outline";
const TRACK_BEAT_GLOW_KEY = "sapphire_track_beat_glow";
const DEFAULT_TRACK_HIGHLIGHT = "#b565f9";
const HEART_SVG_PATH_D =
  "M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z";

function favoriteHeartSvg() {
  return `<svg class="track-favorite-icon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="${HEART_SVG_PATH_D}"/></svg>`;
}
const QUEUE_TRASH_ICON_URL = "/static/img/queue-trash.png";
const FALLBACK_COVER =
  "data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80'%3E%3Crect width='100%25' height='100%25' fill='%23141414'/%3E%3Cpath d='M18 20h44v40H18z' fill='none' stroke='%23666' stroke-width='2'/%3E%3Ccircle cx='48' cy='52' r='8' fill='none' stroke='%23666' stroke-width='2'/%3E%3Cpath d='M34 30v22a7 7 0 1 0 2 5V36h14v16a7 7 0 1 0 2 5V30z' fill='%23666'/%3E%3C/svg%3E";

function applyTheme(themeName) {
  document.body.classList.toggle("theme-light", themeName === "light");
  localStorage.setItem("sapphire_theme", themeName);
}

function normalizeTrackHighlightHex(value) {
  if (typeof value !== "string") return DEFAULT_TRACK_HIGHLIGHT;
  let v = value.trim().replace(/\s/g, "");
  if (!v) return DEFAULT_TRACK_HIGHLIGHT;
  if (!v.startsWith("#")) v = `#${v}`;
  if (/^#[0-9A-Fa-f]{3}$/.test(v)) {
    const r = v[1];
    const g = v[2];
    const b = v[3];
    v = `#${r}${r}${g}${g}${b}${b}`;
  }
  if (/^#[0-9A-Fa-f]{6}$/.test(v)) return v.toLowerCase();
  return DEFAULT_TRACK_HIGHLIGHT;
}

function applyTrackHighlight(hex) {
  const color = normalizeTrackHighlightHex(hex);
  document.documentElement.style.setProperty("--track-highlight-mid", color);
  localStorage.setItem(TRACK_HIGHLIGHT_KEY, color);
  if (trackHighlightColorInput && trackHighlightColorInput.value !== color) {
    trackHighlightColorInput.value = color;
  }
  if (trackHighlightHexInput && trackHighlightHexInput.value !== color) {
    trackHighlightHexInput.value = color;
  }
}

function loadTrackHighlight() {
  const stored = localStorage.getItem(TRACK_HIGHLIGHT_KEY);
  applyTrackHighlight(stored || DEFAULT_TRACK_HIGHLIGHT);
}

function applyPlayerGlow(enabled) {
  document.body.classList.toggle("player-glow-off", !enabled);
  localStorage.setItem(PLAYER_GLOW_KEY, enabled ? "1" : "0");
}

function loadPlayerGlow() {
  const v = localStorage.getItem(PLAYER_GLOW_KEY);
  const enabled = v !== "0" && v !== "false";
  document.body.classList.toggle("player-glow-off", !enabled);
  if (playerGlowToggle) playerGlowToggle.checked = enabled;
}

function applyTopbarGlow(enabled) {
  document.body.classList.toggle("topbar-glow-off", !enabled);
  localStorage.setItem(TOPBAR_GLOW_KEY, enabled ? "1" : "0");
}

function loadTopbarGlow() {
  const v = localStorage.getItem(TOPBAR_GLOW_KEY);
  const enabled = v !== "0" && v !== "false";
  document.body.classList.toggle("topbar-glow-off", !enabled);
  if (topbarGlowToggle) topbarGlowToggle.checked = enabled;
}

function applyTopbarOutline(enabled) {
  document.body.classList.toggle("topbar-outline-off", !enabled);
  localStorage.setItem(TOPBAR_OUTLINE_KEY, enabled ? "1" : "0");
}

function loadTopbarOutline() {
  const v = localStorage.getItem(TOPBAR_OUTLINE_KEY);
  const enabled = v !== "0" && v !== "false";
  document.body.classList.toggle("topbar-outline-off", !enabled);
  if (topbarOutlineToggle) topbarOutlineToggle.checked = enabled;
}

function applyTrackBeatGlow(enabled) {
  document.body.classList.toggle("track-beat-glow-off", !enabled);
  localStorage.setItem(TRACK_BEAT_GLOW_KEY, enabled ? "1" : "0");
  if (!enabled) stopBeatGlowRaf();
  else if (!audioPlayer.paused && selectedTrackId) startBeatGlowRafIfEnabled();
}

function loadTrackBeatGlow() {
  const v = localStorage.getItem(TRACK_BEAT_GLOW_KEY);
  const enabled = v !== "0" && v !== "false";
  document.body.classList.toggle("track-beat-glow-off", !enabled);
  if (trackBeatGlowToggle) trackBeatGlowToggle.checked = enabled;
}

function clearAppBeatGlow() {
  document.documentElement.style.removeProperty("--app-beat-glow-opacity");
  document.documentElement.style.removeProperty("--app-beat-glow-wave-scale");
}

function stopBeatGlowRaf() {
  if (beatGlowRafId) cancelAnimationFrame(beatGlowRafId);
  beatGlowRafId = 0;
  beatPrevBass = 0;
  beatSmoothed = 0;
  clearAppBeatGlow();
}

function prepareBeatAnalyser() {
  if (beatAudioGraphFailed) return false;
  if (beatAudioGraphReady && beatAudioCtx) {
    void beatAudioCtx.resume();
    return true;
  }
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) {
      beatAudioGraphFailed = true;
      return false;
    }
    beatAudioCtx = new AC();
    beatAnalyser = beatAudioCtx.createAnalyser();
    beatAnalyser.fftSize = 256;
    beatAnalyser.smoothingTimeConstant = 0.78;
    beatSourceNode = beatAudioCtx.createMediaElementSource(audioPlayer);
    beatSourceNode.connect(beatAnalyser);
    beatAnalyser.connect(beatAudioCtx.destination);
    beatFreqData = new Uint8Array(beatAnalyser.frequencyBinCount);
    beatAudioGraphReady = true;
    void beatAudioCtx.resume();
    return true;
  } catch (_err) {
    beatAudioGraphFailed = true;
    return false;
  }
}

function beatGlowTick() {
  beatGlowRafId = 0;
  if (document.body.classList.contains("track-beat-glow-off")) {
    clearAppBeatGlow();
    return;
  }
  if (!selectedTrackId || audioPlayer.paused || !audioPlayer.src) {
    clearAppBeatGlow();
    return;
  }

  let bassNorm = 0;
  if (beatAnalyser && beatFreqData && prepareBeatAnalyser()) {
    beatAnalyser.getByteFrequencyData(beatFreqData);
    let sum = 0;
    for (let i = 0; i < 14; i++) sum += beatFreqData[i];
    bassNorm = sum / (14 * 255);
  }

  const flux = Math.max(0, bassNorm - beatPrevBass * 0.94);
  beatPrevBass = beatPrevBass * 0.9 + bassNorm * 0.1;
  beatSmoothed = beatSmoothed * 0.82 + bassNorm * 0.12 + Math.min(0.55, flux * 5.5) * 0.24;

  const t = performance.now() / 1000;
  const breath = ((Math.sin(t * Math.PI * 2 * 2.4) + 1) * 0.5) * 0.09;
  const vol = Math.sqrt(Math.max(0, Math.min(1, audioPlayer.volume)));
  let glow = beatSmoothed * 0.62 + breath * (0.2 + beatSmoothed) + vol * 0.28;
  glow = Math.max(0.06, Math.min(1, glow)) * 0.55;

  const waveScale = 1 + Math.min(0.18, flux * 4.2) + beatSmoothed * 0.05;
  document.documentElement.style.setProperty("--app-beat-glow-wave-scale", waveScale.toFixed(3));

  document.documentElement.style.setProperty("--app-beat-glow-opacity", glow.toFixed(3));

  beatGlowRafId = requestAnimationFrame(beatGlowTick);
}

function startBeatGlowRafIfEnabled() {
  if (document.body.classList.contains("track-beat-glow-off")) return;
  if (!selectedTrackId || audioPlayer.paused) return;
  if (!beatGlowRafId) beatGlowRafId = requestAnimationFrame(beatGlowTick);
}

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
  document.querySelectorAll(".player-btn, .panel, .track-item, .topbar, .player-bar, #searchInput, #fileInput, .upload-btn, .category-item, .playlist-card, .likes-header, .settings-control-row, .categories-user-strip").forEach((element) => {
    element.classList.add("cursor-reactive");
  });

  // Dynamic list buttons (except plain library icons: heart / settings).
  document.querySelectorAll(".actions .icon-btn:not(.track-favorite-btn):not(.track-menu-btn):not(.queue-remove-btn)").forEach((element) => {
    element.classList.add("cursor-reactive");
  });
}

function onUiUpdated() {
  initCursorReactiveElements();
}

function initSmoothTrackListScroll(el) {
  if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  if (el.dataset.smoothScrollInit === "1") return;
  el.dataset.smoothScrollInit = "1";

  let rafId = 0;
  let targetScroll = null;

  const cancelAnim = () => {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
    targetScroll = null;
  };

  el.addEventListener(
    "wheel",
    (e) => {
      if (e.ctrlKey) return;
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;

      const max = el.scrollHeight - el.clientHeight;
      if (max <= 0) return;

      e.preventDefault();

      const curTop = el.scrollTop;
      if (targetScroll === null) targetScroll = curTop;
      targetScroll = Math.max(0, Math.min(max, targetScroll + e.deltaY));

      const step = () => {
        const cur = el.scrollTop;
        const diff = targetScroll - cur;
        if (Math.abs(diff) < 0.45) {
          el.scrollTop = targetScroll;
          cancelAnim();
          return;
        }
        el.scrollTop = cur + diff * 0.2;
        rafId = requestAnimationFrame(step);
      };

      if (!rafId) rafId = requestAnimationFrame(step);
    },
    { passive: false }
  );
}

function filteredTracks() {
  if (!searchQuery) return tracks;
  return tracks.filter((track) => {
    const blob = `${track.title} ${track.artist} ${track.original_filename || ""}`.toLowerCase();
    return blob.includes(searchQuery);
  });
}

function getFavoriteIds() {
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    const parsed = JSON.parse(raw || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch (_e) {
    return [];
  }
}

function isFavoriteTrack(trackId) {
  return getFavoriteIds().includes(trackId);
}

function toggleFavoriteTrack(trackId) {
  const ids = getFavoriteIds();
  const idx = ids.indexOf(trackId);
  if (idx >= 0) ids.splice(idx, 1);
  else ids.push(trackId);
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(ids));
}

function tracksCountWordRu(n) {
  const abs = Math.abs(n) % 100;
  const n1 = abs % 10;
  if (abs >= 11 && abs <= 14) return "треков";
  if (n1 === 1) return "трек";
  if (n1 >= 2 && n1 <= 4) return "трека";
  return "треков";
}

function removeTrackFromFavorites(trackId) {
  const ids = getFavoriteIds().filter((id) => id !== trackId);
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(ids));
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
    row.dataset.trackId = track.id;
    const selectedClass = selectedTrackId === track.id ? "selected-track-title" : "";
    const fav = isFavoriteTrack(track.id);
    const favClass = fav ? "is-favorite" : "";
    row.innerHTML = `
      <img class="track-cover" src="${track.cover_url || FALLBACK_COVER}" alt="" loading="lazy" onerror="this.src='${FALLBACK_COVER}'" />
      <div class="track-main" data-play-track="${track.id}">
        <div class="track-title-line">
          <span class="title ${selectedClass}">${track.title}</span>
        </div>
        <div class="track-meta-line">
          <span class="meta">${track.artist} • ${track.duration_label}</span>
        </div>
      </div>
      <div class="actions">
        <button type="button" class="ghost icon-btn track-favorite-btn ${favClass}" data-favorite-track="${track.id}" title="${fav ? "Убрать из избранного" : "В избранное"}" aria-label="${fav ? "Убрать из избранного" : "В избранное"}" aria-pressed="${fav ? "true" : "false"}">
          ${favoriteHeartSvg()}
        </button>
        <button type="button" class="ghost icon-btn track-menu-btn" data-menu-track="${track.id}" title="Настройки трека" aria-label="Настройки трека">
          <svg class="track-settings-icon" viewBox="0 0 24 24" aria-hidden="true" width="18" height="18">
            <path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M7 5v14" />
            <circle cx="7" cy="7" r="2.5" fill="currentColor" />
            <path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M12 5v14" />
            <circle cx="12" cy="17" r="2.5" fill="currentColor" />
            <path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M17 5v14" />
            <circle cx="17" cy="7" r="2.5" fill="currentColor" />
          </svg>
        </button>
      </div>
    `;
    tracksList.appendChild(row);
  });
  onUiUpdated();
}

function renderLikes() {
  if (!likesList || !likesCountEl) return;

  const favSet = new Set(getFavoriteIds());
  const liked = tracks.filter((track) => favSet.has(track.id));
  likesCountEl.textContent = String(liked.length);
  if (likesCountLabelEl) likesCountLabelEl.textContent = tracksCountWordRu(liked.length);

  likesList.innerHTML = "";
  if (!liked.length) {
    likesList.innerHTML = `<div class="meta">Нет избранных треков. Нажмите ♥ в библиотеке.</div>`;
    onUiUpdated();
    return;
  }

  liked.forEach((track) => {
    const row = document.createElement("div");
    row.className = "track-item cursor-reactive likes-track-row";
    row.dataset.trackId = track.id;
    const selectedClass = selectedTrackId === track.id ? "selected-track-title" : "";
    row.innerHTML = `
      <img class="track-cover" src="${track.cover_url || FALLBACK_COVER}" alt="" loading="lazy" onerror="this.src='${FALLBACK_COVER}'" />
      <div class="track-main" data-play-track="${track.id}">
        <div class="track-title-line">
          <span class="title ${selectedClass}">${track.title}</span>
        </div>
        <div class="track-meta-line">
          <span class="meta">${track.artist}</span>
        </div>
      </div>
      <div class="actions likes-track-actions">
        <span class="track-duration muted">${track.duration_label || "—"}</span>
        <button type="button" class="ghost icon-btn track-favorite-btn is-favorite" data-favorite-track="${track.id}" title="Убрать из «Мне нравится»" aria-label="Убрать из «Мне нравится»" aria-pressed="true">
          ${favoriteHeartSvg()}
        </button>
        <button type="button" class="ghost icon-btn track-menu-btn" data-menu-track="${track.id}" title="Настройки трека" aria-label="Настройки трека">
          <svg class="track-settings-icon" viewBox="0 0 24 24" aria-hidden="true" width="18" height="18">
            <path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M7 5v14" />
            <circle cx="7" cy="7" r="2.5" fill="currentColor" />
            <path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M12 5v14" />
            <circle cx="12" cy="17" r="2.5" fill="currentColor" />
            <path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M17 5v14" />
            <circle cx="17" cy="7" r="2.5" fill="currentColor" />
          </svg>
        </button>
      </div>
    `;
    likesList.appendChild(row);
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
    row.dataset.trackId = item.id;
    const selectedClass = selectedTrackId === item.id ? "selected-track-title" : "";
    row.innerHTML = `
      <img class="track-cover" src="${item.cover_url || FALLBACK_COVER}" alt="" loading="lazy" onerror="this.src='${FALLBACK_COVER}'" />
      <div class="track-main" data-play-queue="${index}">
        <div class="track-title-line">
          <span class="title ${selectedClass}">${item.title}</span>
        </div>
        <div class="track-meta-line">
          <span class="meta">${item.artist}</span>
        </div>
      </div>
      <div class="actions">
        <button type="button" class="ghost icon-btn queue-remove-btn" data-remove="${item.queue_item_id}" title="Убрать из очереди" aria-label="Убрать из очереди">
          <img class="queue-trash-img" src="${QUEUE_TRASH_ICON_URL}" width="18" height="18" alt="" draggable="false" />
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

function getOpenedPlaylist() {
  if (!openedPlaylistId) return null;
  return playlists.find((p) => p.id === openedPlaylistId) || null;
}

function renderPlaylistDetailTracks(playlist) {
  if (!playlistDetailList) return;
  playlistDetailList.innerHTML = "";
  const list = Array.isArray(playlist.tracks) ? playlist.tracks : [];
  if (playlistPlayAllBtn) playlistPlayAllBtn.disabled = list.length === 0;
  if (!list.length) {
    playlistDetailList.innerHTML = `<div class="meta">В этом плейлисте пока нет треков.</div>`;
    onUiUpdated();
    return;
  }
  list.forEach((track) => {
    const row = document.createElement("div");
    row.className = "track-item cursor-reactive playlist-detail-track";
    row.dataset.trackId = track.id;
    const selectedClass = selectedTrackId === track.id ? "selected-track-title" : "";
    const fav = isFavoriteTrack(track.id);
    const favClass = fav ? "is-favorite" : "";
    row.innerHTML = `
      <img class="track-cover" src="${track.cover_url || FALLBACK_COVER}" alt="" loading="lazy" onerror="this.src='${FALLBACK_COVER}'" />
      <div class="track-main" data-play-track="${track.id}">
        <div class="track-title-line">
          <span class="title ${selectedClass}">${track.title}</span>
        </div>
        <div class="track-meta-line">
          <span class="meta">${track.artist} • ${track.duration_label || "—"}</span>
        </div>
      </div>
      <div class="actions">
        <button type="button" class="ghost icon-btn track-favorite-btn ${favClass}" data-favorite-track="${track.id}" title="${fav ? "Убрать из избранного" : "В избранное"}" aria-label="${fav ? "Убрать из избранного" : "В избранное"}" aria-pressed="${fav ? "true" : "false"}">
          ${favoriteHeartSvg()}
        </button>
        <button type="button" class="ghost icon-btn track-menu-btn" data-menu-track="${track.id}" title="Настройки трека" aria-label="Настройки трека">
          <svg class="track-settings-icon" viewBox="0 0 24 24" aria-hidden="true" width="18" height="18">
            <path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M7 5v14" />
            <circle cx="7" cy="7" r="2.5" fill="currentColor" />
            <path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M12 5v14" />
            <circle cx="12" cy="17" r="2.5" fill="currentColor" />
            <path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M17 5v14" />
            <circle cx="17" cy="7" r="2.5" fill="currentColor" />
          </svg>
        </button>
      </div>
    `;
    playlistDetailList.appendChild(row);
  });
  onUiUpdated();
}

function showPlaylistDetail(playlist) {
  if (!playlistsBrowse || !playlistDetailPanel || !playlistDetailCover || !playlistDetailTitle || !playlistDetailMeta) return;
  openedPlaylistId = playlist.id;
  playlistDetailCover.src = playlist.cover_url || FALLBACK_COVER;
  playlistDetailCover.alt = playlist.name || "Плейлист";
  playlistDetailTitle.textContent = playlist.name || "Плейлист";
  const n = Array.isArray(playlist.tracks) ? playlist.tracks.length : 0;
  playlistDetailMeta.textContent = `${n} ${tracksCountWordRu(n)}`;
  renderPlaylistDetailTracks(playlist);
  playlistsBrowse.classList.add("is-hidden");
  playlistDetailPanel.classList.remove("is-hidden");
  playlistDetailPanel.setAttribute("aria-hidden", "false");
}

function hidePlaylistDetail() {
  openedPlaylistId = null;
  if (playlistsBrowse) playlistsBrowse.classList.remove("is-hidden");
  if (playlistDetailPanel) {
    playlistDetailPanel.classList.add("is-hidden");
    playlistDetailPanel.setAttribute("aria-hidden", "true");
  }
}

function syncPlaylistDetailIfOpen() {
  if (!openedPlaylistId) return;
  const playlist = playlists.find((p) => p.id === openedPlaylistId);
  if (!playlist) {
    hidePlaylistDetail();
    return;
  }
  if (playlistDetailCover) {
    playlistDetailCover.src = playlist.cover_url || FALLBACK_COVER;
    playlistDetailCover.alt = playlist.name || "Плейлист";
  }
  if (playlistDetailTitle) playlistDetailTitle.textContent = playlist.name || "Плейлист";
  if (playlistDetailMeta) {
    const n = Array.isArray(playlist.tracks) ? playlist.tracks.length : 0;
    playlistDetailMeta.textContent = `${n} ${tracksCountWordRu(n)}`;
  }
  renderPlaylistDetailTracks(playlist);
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
      showPlaylistDetail(playlist);
    });
    playlistsGrid.appendChild(card);
  });
  onUiUpdated();
  syncPlaylistDetailIfOpen();
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return "0:00";
  const s = Math.floor(seconds);
  const minutes = Math.floor(s / 60);
  const remainder = s % 60;
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

function syncSeekBarGradientPct() {
  const max = Number(seekBar.max);
  const val = Number(seekBar.value);
  if (!Number.isFinite(max) || max <= 0) {
    seekBar.style.setProperty("--seek-pct", "0");
    return;
  }
  const pct = Math.min(100, Math.max(0, (val / max) * 100));
  seekBar.style.setProperty("--seek-pct", pct.toFixed(2));
}

function syncPasswordToggleUi() {
  if (!loginPassword) return;
  const revealed = loginPassword.type === "text";
  const showIcon = document.querySelector("#authModal .auth-password-icon-show");
  const hideIcon = document.querySelector("#authModal .auth-password-icon-hide");
  if (showIcon) showIcon.classList.toggle("is-hidden", revealed);
  if (hideIcon) hideIcon.classList.toggle("is-hidden", !revealed);
}

function setSidebarUser(username) {
  const loginEl = document.getElementById("categoriesUserLogin");
  const avEl = document.getElementById("categoriesUserAvatar");
  if (!loginEl || !avEl) return;
  const name = (username || "").trim();
  if (!name) {
    loginEl.textContent = "—";
    avEl.textContent = "?";
    return;
  }
  loginEl.textContent = name;
  avEl.textContent = name.charAt(0).toUpperCase();
}

function showAuthModal() {
  if (!authModal) return;
  authModal.classList.remove("is-hidden");
  authModal.setAttribute("aria-hidden", "false");
  if (loginPassword) {
    loginPassword.type = "password";
    syncPasswordToggleUi();
  }
  if (loginPasswordToggle) {
    loginPasswordToggle.setAttribute("aria-label", "Показать пароль");
    loginPasswordToggle.title = "Показать пароль";
  }
}

function hideAuthModal() {
  if (!authModal) return;
  authModal.classList.add("is-hidden");
  authModal.setAttribute("aria-hidden", "true");
  if (loginError) {
    loginError.textContent = "";
    loginError.classList.add("is-hidden");
  }
}

function resetAppAfterLogout() {
  stopBeatGlowRaf();
  beatAudioCtx = null;
  beatAnalyser = null;
  beatSourceNode = null;
  beatFreqData = null;
  beatAudioGraphReady = false;
  beatAudioGraphFailed = false;
  tracks = [];
  queue = [];
  playlists = [];
  currentQueueIndex = -1;
  selectedTrackId = null;
  try {
    audioPlayer.pause();
    audioPlayer.removeAttribute("src");
    audioPlayer.load();
  } catch (_e) {
    /* ignore */
  }
  setNowPlaying(null);
  setPlayButtonState(false);
  hideTrackMenu();
  closeTrackDetailsModal();
  hidePlaylistDetail();
  renderTracks();
  renderQueue();
  renderLikes();
  renderPlaylists();
  syncPlaylistDetailIfOpen();
  updateVolume(30);
  syncSeekBarGradientPct();
  setSidebarUser("");
}

async function bootstrapApp() {
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
          credentials: "same-origin",
          body: JSON.stringify({ action: "replace", queue: parsed }),
        });
        await fetchQueue();
      }
    } catch (_error) {
      // Ignore broken localStorage payloads.
    }
  }
  setPlayButtonState(false);
  updateVolume(30);
  syncSeekBarGradientPct();
  setView("main", { scroll: false });
  initSmoothTrackListScroll(tracksList);
  initSmoothTrackListScroll(queueList);
  initSmoothTrackListScroll(likesList);
  if (playlistDetailList) initSmoothTrackListScroll(playlistDetailList);
}

async function fetchTracks() {
  const response = await fetch("/tracks");
  tracks = await response.json();
  renderTracks();
  renderLikes();
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
    selectedTrackId = null;
    setNowPlaying(null);
    setPlayButtonState(false);
  }

  queue = payload.queue || [];
  playlists = payload.playlists || playlists;
  localStorage.setItem("music_queue", JSON.stringify(queue));
  removeTrackFromFavorites(trackId);
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
  if (openedPlaylistId === playlistId) hidePlaylistDetail();
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

async function removeTrackFromOpenedPlaylist(trackId) {
  const opened = getOpenedPlaylist();
  if (!opened) return;
  const response = await fetch(`/playlists/${opened.id}/tracks/${trackId}`, {
    method: "DELETE",
  });
  const payload = await response.json();
  if (!response.ok) {
    alert(payload.error || "Не удалось удалить трек из плейлиста");
    return;
  }
  playlists = playlists.map((item) => (item.id === opened.id ? payload : item));
  hideTrackMenu();
  renderPlaylists();
  syncPlaylistDetailIfOpen();
}

async function playPlaylistAsQueue(playlist) {
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
    alert("Не удалось запустить плейлист.");
    return;
  }

  queue = await response.json();
  localStorage.setItem("music_queue", JSON.stringify(queue));
  renderQueue();
  playQueueIndex(0);
}

async function replaceQueueWithOpenedPlaylistTracksAndPlay(trackId) {
  const playlist = getOpenedPlaylist();
  if (!playlist) return;
  const plTracks = Array.isArray(playlist.tracks) ? playlist.tracks : [];
  const idx = plTracks.findIndex((t) => t.id === trackId);
  if (idx < 0) return;

  const preparedQueue = plTracks.map((track) => ({
    ...track,
    queue_item_id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}_${Math.random()}`,
  }));

  const response = await fetch("/queue", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "replace", queue: preparedQueue }),
  });

  if (!response.ok) {
    alert("Не удалось запустить очередь из плейлиста.");
    return;
  }

  queue = await response.json();
  localStorage.setItem("music_queue", JSON.stringify(queue));
  renderQueue();
  playQueueIndex(idx);
}

function getLikedTracksOrdered() {
  const favSet = new Set(getFavoriteIds());
  return tracks.filter((track) => favSet.has(track.id));
}

async function replaceQueueWithLikedTracksAndPlay(trackId) {
  const liked = getLikedTracksOrdered();
  const idx = liked.findIndex((t) => t.id === trackId);
  if (idx < 0) return;

  const preparedQueue = liked.map((track) => ({
    ...track,
    queue_item_id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}_${Math.random()}`,
  }));

  const response = await fetch("/queue", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "replace", queue: preparedQueue }),
  });

  if (!response.ok) {
    alert("Не удалось запустить очередь из избранного.");
    return;
  }

  queue = await response.json();
  localStorage.setItem("music_queue", JSON.stringify(queue));
  renderQueue();
  playQueueIndex(idx);
}

function renderTrackMenu(trackId) {
  activeTrackMenuId = trackId;
  menuPlaylists.innerHTML = "";

  const opened = getOpenedPlaylist();
  const inOpenedPlaylist =
    Boolean(opened) &&
    Array.isArray(opened.tracks) &&
    opened.tracks.some((t) => t.id === trackId);
  if (menuRemoveFromPlaylist) {
    menuRemoveFromPlaylist.classList.toggle("is-hidden", !inOpenedPlaylist);
  }

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

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text == null ? "" : String(text);
  return div.innerHTML;
}

function closeTrackDetailsModal() {
  if (!trackDetailsModal) return;
  trackDetailsModal.classList.add("is-hidden");
  trackDetailsModal.setAttribute("aria-hidden", "true");
}

function openTrackDetailsModal(trackId) {
  if (!trackDetailsModal || !trackDetailsBody || !trackId) return;
  const track = tracks.find((t) => t.id === trackId);
  if (!track) {
    trackDetailsBody.innerHTML = `<p class="track-details-empty">Информация о треке недоступна.</p>`;
  } else {
    const row = (label, value, mono) => {
      const valueClass = mono ? "track-details-value is-mono" : "track-details-value";
      return `<div class="track-details-row"><div class="track-details-label">${escapeHtml(label)}</div><div class="${valueClass}">${escapeHtml(value)}</div></div>`;
    };
    trackDetailsBody.innerHTML = `<div class="track-details-rows">${row("Название", track.title || "—")}${row("Исполнитель", track.artist || "—")}${row("Длительность", track.duration_label || "—")}${row("Файл", track.original_filename || track.filename || "—")}${row("ID", track.id, true)}</div>`;
  }
  trackDetailsModal.classList.remove("is-hidden");
  trackDetailsModal.setAttribute("aria-hidden", "false");
}

/** Соответствует `scroll-padding-top` в CSS (шапка). */
const SECTION_SCROLL_PADDING_TOP = 72;

/** Гистерезис переключения пункта в панели (пиксели за границей секции). */
const SECTION_TAB_HYSTERESIS_PX = 96;

let viewScrollSyncSuppress = false;
let viewScrollSuppressTimer = null;
let sectionScrollRafId = 0;

function getViewportScrollTop() {
  return window.scrollY ?? window.pageYOffset ?? document.documentElement.scrollTop ?? 0;
}

function setViewportScrollTop(y) {
  window.scrollTo({ top: y, left: 0, behavior: "auto" });
}

function getScrollMaxY() {
  const se = document.scrollingElement || document.documentElement;
  return Math.max(0, se.scrollHeight - window.innerHeight);
}

function suppressViewScrollSync(ms) {
  viewScrollSyncSuppress = true;
  clearTimeout(viewScrollSuppressTimer);
  viewScrollSuppressTimer = setTimeout(() => {
    viewScrollSyncSuppress = false;
  }, ms);
}

function getModuleTargetScrollTop(el) {
  const rect = el.getBoundingClientRect();
  return getViewportScrollTop() + rect.top - SECTION_SCROLL_PADDING_TOP;
}

function cancelSectionScrollAnim() {
  if (sectionScrollRafId) {
    cancelAnimationFrame(sectionScrollRafId);
    sectionScrollRafId = 0;
  }
}

/**
 * Плавная прокрутка документа от текущей позиции (обходит конфликт scroll-snap + WebView).
 */
function scrollRootSmoothTo(targetTop, durationMs, behavior) {
  const maxTop = getScrollMaxY();
  const top = Math.max(0, Math.min(targetTop, maxTop));
  const html = document.documentElement;

  if (behavior === "auto") {
    cancelSectionScrollAnim();
    html.style.scrollSnapType = "none";
    setViewportScrollTop(top);
    html.style.scrollSnapType = "";
    return;
  }

  cancelSectionScrollAnim();
  html.style.scrollSnapType = "none";

  const start = getViewportScrollTop();
  const dist = top - start;
  if (Math.abs(dist) < 1) {
    html.style.scrollSnapType = "";
    return;
  }

  const t0 = performance.now();

  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function frame(now) {
    const t = Math.min(1, (now - t0) / durationMs);
    setViewportScrollTop(start + dist * easeOutCubic(t));
    if (t < 1) {
      sectionScrollRafId = requestAnimationFrame(frame);
    } else {
      setViewportScrollTop(top);
      sectionScrollRafId = 0;
      html.style.scrollSnapType = "";
    }
  }

  sectionScrollRafId = requestAnimationFrame(frame);
}

function scrollPageToView(viewName, behavior) {
  let el = mainView;
  if (viewName === "likes") el = likesView;
  else if (viewName === "playlists") el = playlistsView;
  else if (viewName === "settings") el = settingsView;
  if (!el) return;
  const target = getModuleTargetScrollTop(el);
  scrollRootSmoothTo(target, 520, behavior);
}

function getModuleDocumentTop(el) {
  return el.getBoundingClientRect().top + getViewportScrollTop();
}

function getSectionScrollAnchorTops() {
  return {
    main: getModuleDocumentTop(mainView),
    likes: getModuleDocumentTop(likesView),
    playlists: getModuleDocumentTop(playlistsView),
    settings: getModuleDocumentTop(settingsView),
  };
}

function syncCategoryFromPageScroll() {
  if (viewScrollSyncSuppress || !mainView || !likesView || !playlistsView || !settingsView) return;
  const y = getViewportScrollTop();
  const anchor = y + window.innerHeight * 0.36;
  const t = getSectionScrollAnchorTops();
  const B1 = (t.main + t.likes) / 2;
  const B2 = (t.likes + t.playlists) / 2;
  const B3 = (t.playlists + t.settings) / 2;
  const h = SECTION_TAB_HYSTERESIS_PX;

  let next = currentView;
  if (currentView === "main") {
    if (anchor > B3 + h) next = "settings";
    else if (anchor > B2 + h) next = "playlists";
    else if (anchor > B1 + h) next = "likes";
  } else if (currentView === "likes") {
    if (anchor < B1 - h) next = "main";
    else if (anchor > B3 + h) next = "settings";
    else if (anchor > B2 + h) next = "playlists";
  } else if (currentView === "playlists") {
    if (anchor < B1 - h) next = "main";
    else if (anchor < B2 - h) next = "likes";
    else if (anchor > B3 + h) next = "settings";
  } else if (currentView === "settings") {
    if (anchor < B1 - h) next = "main";
    else if (anchor < B2 - h) next = "likes";
    else if (anchor < B3 - h) next = "playlists";
  }

  if (next !== currentView) {
    currentView = next;
    categoryItems.forEach((item) => item.classList.toggle("is-active", item.dataset.view === next));
  }
}

function setView(viewName, options = {}) {
  const { scroll = true, behavior = "smooth" } = options;
  currentView = viewName;
  if (viewName !== "playlists") hidePlaylistDetail();
  categoryItems.forEach((item) => item.classList.toggle("is-active", item.dataset.view === viewName));

  if (scroll && mainView && likesView && playlistsView && settingsView) {
    const ms = behavior === "auto" ? 120 : 650;
    suppressViewScrollSync(ms);
    requestAnimationFrame(() => scrollPageToView(viewName, behavior));
  }
}

function setNowPlaying(track) {
  nowTitle.textContent = track?.title || "No track selected";
  nowArtist.textContent = track?.artist || "-";
}

function playQueueIndex(index) {
  if (!queue.length || index < 0 || index >= queue.length) return;
  currentQueueIndex = index;
  const track = queue[index];
  selectedTrackId = track.id;
  audioPlayer.src = track.audio_url;
  audioPlayer.play();
  setPlayButtonState(true);
  setNowPlaying(track);
  renderQueue();
  renderTracks();
  renderLikes();
  syncPlaylistDetailIfOpen();
}

function playNext() {
  if (!queue.length) return;
  const nextIndex = currentQueueIndex + 1;
  if (nextIndex < queue.length) {
    playQueueIndex(nextIndex);
  } else {
    currentQueueIndex = -1;
    selectedTrackId = null;
    stopBeatGlowRaf();
    setPlayButtonState(false);
    setNowPlaying(null);
    renderTracks();
    renderLikes();
    syncPlaylistDetailIfOpen();
  }
}

function playPrevious() {
  if (!queue.length) return;
  const prevIndex = currentQueueIndex - 1;
  if (prevIndex >= 0) playQueueIndex(prevIndex);
}

function isAllowedUploadFile(file) {
  if (!file || !file.name) return false;
  const dot = file.name.lastIndexOf(".");
  if (dot < 0) return false;
  const ext = file.name.slice(dot + 1).toLowerCase();
  return ext === "mp3" || ext === "wav";
}

async function uploadAudioFile(file) {
  const formData = new FormData();
  formData.append("file", file);
  try {
    const response = await fetch("/upload", {
      method: "POST",
      body: formData,
    });
    let payload = {};
    try {
      payload = await response.json();
    } catch (_e) {
      payload = {};
    }
    if (!response.ok) {
      return { ok: false, error: payload.error || "Не удалось загрузить файл" };
    }
    return { ok: true };
  } catch (_err) {
    return { ok: false, error: "Сеть недоступна или сервер не отвечает" };
  }
}

function clearAppFileDragHighlight() {
  document.body.classList.remove("app-drag-files-active");
}

uploadForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const file = fileInput.files[0];
  if (!file) return;

  const result = await uploadAudioFile(file);
  if (!result.ok) {
    alert(result.error);
    return;
  }

  fileInput.value = "";
  await fetchTracks();
});

window.addEventListener("dragover", (event) => {
  if (!event.dataTransfer || !Array.from(event.dataTransfer.types).includes("Files")) return;
  event.preventDefault();
  event.dataTransfer.dropEffect = "copy";
  document.body.classList.add("app-drag-files-active");
});

window.addEventListener("dragleave", (event) => {
  if (event.relatedTarget !== null && document.documentElement.contains(event.relatedTarget)) return;
  clearAppFileDragHighlight();
});

window.addEventListener("drop", async (event) => {
  clearAppFileDragHighlight();
  const dt = event.dataTransfer;
  if (!dt || !dt.files || dt.files.length === 0) return;

  const all = Array.from(dt.files);
  const audioFiles = all.filter(isAllowedUploadFile);
  if (!audioFiles.length) {
    if (all.length > 0) {
      event.preventDefault();
      alert("Поддерживаются только MP3 и WAV.");
    }
    return;
  }

  event.preventDefault();

  const errors = [];
  for (const file of audioFiles) {
    const result = await uploadAudioFile(file);
    if (!result.ok) errors.push(`${file.name}: ${result.error}`);
  }
  if (errors.length) alert(errors.join("\n"));
  await fetchTracks();
});

uploadIconBtn.addEventListener("click", () => {
  fileInput.click();
});

fileInput.addEventListener("change", () => {
  if (fileInput.files && fileInput.files[0]) {
    uploadForm.requestSubmit();
  }
});

themeToggleBtn.addEventListener("click", () => {
  const nextTheme = document.body.classList.contains("theme-light") ? "dark" : "light";
  applyTheme(nextTheme);
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

  const favBtn = event.target.closest("[data-favorite-track]");
  if (favBtn) {
    event.stopPropagation();
    const fid = favBtn.getAttribute("data-favorite-track");
    toggleFavoriteTrack(fid);
    const on = isFavoriteTrack(fid);
    favBtn.classList.toggle("is-favorite", on);
    favBtn.setAttribute("aria-pressed", on ? "true" : "false");
    favBtn.setAttribute("aria-label", on ? "Убрать из избранного" : "В избранное");
    favBtn.title = on ? "Убрать из избранного" : "В избранное";
    renderLikes();
    return;
  }

  const button = event.target.closest("button");
  if (!button) return;
  const menuTrackId = button.getAttribute("data-menu-track");
  if (menuTrackId) {
    event.stopPropagation();
    showTrackMenu(menuTrackId, button);
    return;
  }
});

likesList.addEventListener("click", (event) => {
  const trackMain = event.target.closest("[data-play-track]");
  if (trackMain) {
    const trackId = trackMain.getAttribute("data-play-track");
    void replaceQueueWithLikedTracksAndPlay(trackId);
    return;
  }

  const favBtn = event.target.closest("[data-favorite-track]");
  if (favBtn) {
    event.stopPropagation();
    const fid = favBtn.getAttribute("data-favorite-track");
    toggleFavoriteTrack(fid);
    renderTracks();
    renderLikes();
    return;
  }

  const button = event.target.closest("button");
  if (!button) return;
  const menuTrackId = button.getAttribute("data-menu-track");
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

if (menuTrackDetails) {
  menuTrackDetails.addEventListener("click", (event) => {
    event.stopPropagation();
    if (!activeTrackMenuId) return;
    const trackIdForDetails = activeTrackMenuId;
    hideTrackMenu();
    openTrackDetailsModal(trackIdForDetails);
  });
}

if (trackDetailsBackdrop) {
  trackDetailsBackdrop.addEventListener("click", () => closeTrackDetailsModal());
}
if (trackDetailsClose) {
  trackDetailsClose.addEventListener("click", () => closeTrackDetailsModal());
}
if (trackDetailsOk) {
  trackDetailsOk.addEventListener("click", () => closeTrackDetailsModal());
}

window.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  if (!trackDetailsModal || trackDetailsModal.classList.contains("is-hidden")) return;
  closeTrackDetailsModal();
});

menuAddToQueue.addEventListener("click", () => {
  if (!activeTrackMenuId) return;
  addToQueue(activeTrackMenuId);
  hideTrackMenu();
});

if (menuRemoveFromPlaylist) {
  menuRemoveFromPlaylist.addEventListener("click", () => {
    if (!activeTrackMenuId) return;
    const id = activeTrackMenuId;
    hideTrackMenu();
    void removeTrackFromOpenedPlaylist(id);
  });
}

menuDeleteTrack.addEventListener("click", () => {
  if (!activeTrackMenuId) return;
  if (!window.confirm("Удалить этот трек из библиотеки?")) return;
  const id = activeTrackMenuId;
  hideTrackMenu();
  deleteTrack(id);
});

categoryItems.forEach((item) => {
  item.addEventListener("click", () => {
    const view = item.dataset.view || "main";
    setView(view, { behavior: "smooth" });
  });
});

window.addEventListener(
  "scroll",
  () => {
    requestAnimationFrame(syncCategoryFromPageScroll);
  },
  { passive: true }
);

window.addEventListener("scrollend", () => {
  viewScrollSyncSuppress = false;
  syncCategoryFromPageScroll();
});

createPlaylistBtn.addEventListener("click", createPlaylist);

if (playlistDetailBack) {
  playlistDetailBack.addEventListener("click", () => hidePlaylistDetail());
}

if (playlistPlayAllBtn) {
  playlistPlayAllBtn.addEventListener("click", () => {
    const pl = getOpenedPlaylist();
    if (pl) void playPlaylistAsQueue(pl);
  });
}

if (playlistDetailList) {
  playlistDetailList.addEventListener("click", (event) => {
    const trackMain = event.target.closest("[data-play-track]");
    if (trackMain) {
      const trackId = trackMain.getAttribute("data-play-track");
      void replaceQueueWithOpenedPlaylistTracksAndPlay(trackId);
      return;
    }

    const favBtn = event.target.closest("[data-favorite-track]");
    if (favBtn) {
      event.stopPropagation();
      const fid = favBtn.getAttribute("data-favorite-track");
      toggleFavoriteTrack(fid);
      const on = isFavoriteTrack(fid);
      favBtn.classList.toggle("is-favorite", on);
      favBtn.setAttribute("aria-pressed", on ? "true" : "false");
      favBtn.setAttribute("aria-label", on ? "Убрать из избранного" : "В избранное");
      favBtn.title = on ? "Убрать из избранного" : "В избранное";
      renderTracks();
      renderLikes();
      syncPlaylistDetailIfOpen();
      return;
    }

    const button = event.target.closest("button");
    if (!button) return;
    const menuTrackId = button.getAttribute("data-menu-track");
    if (menuTrackId) {
      event.stopPropagation();
      showTrackMenu(menuTrackId, button);
    }
  });
}

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
  syncSeekBarGradientPct();
});

audioPlayer.addEventListener("timeupdate", () => {
  seekBar.value = Math.floor(audioPlayer.currentTime || 0);
  currentTime.textContent = formatTime(audioPlayer.currentTime || 0);
  syncSeekBarGradientPct();
});

seekBar.addEventListener("input", () => {
  audioPlayer.currentTime = Number(seekBar.value);
  syncSeekBarGradientPct();
});

audioPlayer.addEventListener("ended", () => {
  playNext();
});

audioPlayer.addEventListener("play", () => {
  setPlayButtonState(true);
  void prepareBeatAnalyser();
  startBeatGlowRafIfEnabled();
});
audioPlayer.addEventListener("pause", () => {
  setPlayButtonState(false);
  stopBeatGlowRaf();
});

if (trackHighlightColorInput) {
  trackHighlightColorInput.addEventListener("input", () => {
    applyTrackHighlight(trackHighlightColorInput.value);
  });
}
if (trackHighlightHexInput) {
  trackHighlightHexInput.addEventListener("change", () => {
    applyTrackHighlight(trackHighlightHexInput.value);
  });
  trackHighlightHexInput.addEventListener("blur", () => {
    applyTrackHighlight(trackHighlightHexInput.value);
  });
}

if (playerGlowToggle) {
  playerGlowToggle.addEventListener("change", () => {
    applyPlayerGlow(playerGlowToggle.checked);
  });
}

if (topbarGlowToggle) {
  topbarGlowToggle.addEventListener("change", () => {
    applyTopbarGlow(topbarGlowToggle.checked);
  });
}

if (topbarOutlineToggle) {
  topbarOutlineToggle.addEventListener("change", () => {
    applyTopbarOutline(topbarOutlineToggle.checked);
  });
}

if (trackBeatGlowToggle) {
  trackBeatGlowToggle.addEventListener("change", () => {
    applyTrackBeatGlow(trackBeatGlowToggle.checked);
  });
}

if (loginPasswordToggle && loginPassword) {
  loginPasswordToggle.addEventListener("click", () => {
    loginPassword.type = loginPassword.type === "password" ? "text" : "password";
    const revealed = loginPassword.type === "text";
    loginPasswordToggle.setAttribute("aria-label", revealed ? "Скрыть пароль" : "Показать пароль");
    loginPasswordToggle.title = revealed ? "Скрыть пароль" : "Показать пароль";
    syncPasswordToggleUi();
  });
}

if (authForm && loginSubmit) {
  authForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (loginError) {
      loginError.textContent = "";
      loginError.classList.add("is-hidden");
    }
    const username = loginUsername?.value?.trim() || "";
    const password = loginPassword?.value || "";
    loginSubmit.disabled = true;
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ username, password }),
      });
      let data = {};
      try {
        data = await response.json();
      } catch (_e) {
        data = {};
      }
      if (!response.ok) {
        if (loginError) {
          loginError.textContent = data.error || "Не удалось войти";
          loginError.classList.remove("is-hidden");
        }
        return;
      }
      hideAuthModal();
      if (loginPassword) {
        loginPassword.value = "";
        loginPassword.type = "password";
        syncPasswordToggleUi();
      }
      if (loginPasswordToggle) {
        loginPasswordToggle.setAttribute("aria-label", "Показать пароль");
        loginPasswordToggle.title = "Показать пароль";
      }
      setSidebarUser(data.username || "");
      await bootstrapApp();
    } finally {
      loginSubmit.disabled = false;
    }
  });
}

if (logoutBtn) {
  logoutBtn.addEventListener("click", async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
    } catch (_e) {
      /* ignore */
    }
    resetAppAfterLogout();
    showAuthModal();
    queueMicrotask(() => loginUsername?.focus());
  });
}

window.addEventListener("DOMContentLoaded", async () => {
  applyTheme(localStorage.getItem("sapphire_theme") || "dark");
  loadTrackHighlight();
  loadPlayerGlow();
  loadTopbarGlow();
  loadTopbarOutline();
  loadTrackBeatGlow();

  let sessionData = { authenticated: false };
  try {
    const sessionRes = await fetch("/api/auth/session", { credentials: "same-origin" });
    sessionData = await sessionRes.json();
  } catch (_e) {
    sessionData = { authenticated: false };
  }

  if (sessionData.authenticated) {
    hideAuthModal();
    setSidebarUser(sessionData.username || "");
    await bootstrapApp();
  } else {
    setSidebarUser("");
    showAuthModal();
    queueMicrotask(() => loginUsername?.focus());
  }
});

window.addEventListener("mousemove", (event) => {
  updateProximityGlow(event.clientX, event.clientY);
});

window.addEventListener("DOMContentLoaded", () => {
  initCursorReactiveElements();
});
