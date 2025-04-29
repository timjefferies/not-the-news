// js/settings.js
import { restoreStateFromFile, saveStateToFile } from "./api.js";

const SYNC_KEY = "syncEnabled";
const HIDDEN_KEY = "hidden";

// initialize the “refresh feed” toggle
export function initSync(app) {
  const toggle   = document.getElementById('sync-toggle');
  const syncText = document.getElementById('sync-text');
  if (!toggle || !syncText) return;

  // reflect saved state
  toggle.checked       = app.syncEnabled;
  syncText.textContent = app.syncEnabled ? 'yes' : 'no';

  toggle.addEventListener('change', () => {
    app.syncEnabled      = toggle.checked;
    localStorage.setItem(SYNC_KEY, JSON.stringify(app.syncEnabled));
    syncText.textContent  = app.syncEnabled ? 'yes' : 'no';

    // Save sync change to server
    saveStateToFile("appState.json")
      .catch(err => console.error("Save sync setting failed:", err));
  });
}

const IMAGES_KEY = "imagesEnabled";

// initialize the “Show images” toggle
export function initImages(app) {
  const toggle   = document.getElementById('images-toggle');
  const imagesText = document.getElementById('images-text');
  if (!toggle || !imagesText) return;

  // reflect saved state
  toggle.checked        = app.imagesEnabled;
  imagesText.textContent = app.imagesEnabled ? 'yes' : 'no';

  toggle.addEventListener('change', () => {
    app.imagesEnabled      = toggle.checked;
    localStorage.setItem(IMAGES_KEY, JSON.stringify(app.imagesEnabled));
    imagesText.textContent  = app.imagesEnabled ? 'yes' : 'no';

    // Save sync change to server
    saveStateToFile("appState.json")
      .catch(err => console.error("Save show images setting failed:", err));
  });
}

// initialize the theme toggle
export function initTheme() {
  const html      = document.documentElement;
  const toggle    = document.getElementById('theme-toggle');
  const themeText = document.getElementById('theme-text');
  if (!toggle || !themeText) return;

  const saved   = localStorage.getItem('theme');
  const useDark = saved === 'dark'
    || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches);

  html.classList.add(useDark ? 'dark' : 'light');
  toggle.checked       = useDark;
  themeText.textContent = useDark ? 'dark' : 'light';

  toggle.addEventListener('change', () => {
    const newTheme = toggle.checked ? 'dark' : 'light';
    html.classList.toggle('dark', toggle.checked);
    html.classList.toggle('light', !toggle.checked);

    localStorage.setItem('theme', newTheme);
    themeText.textContent = newTheme;

    // persist to server
    saveStateToFile("appState.json")
      .catch(err => console.error("Save theme setting failed:", err));
  });
}
export async function initScrollPos(app) {
  // 1. Capture current scroll and the first visible entry
  const scrollY = window.scrollY;
  localStorage.setItem('feedScrollY', String(scrollY));
  const entries = document.querySelectorAll('.entry');
  for (const el of entries) {
    const { top } = el.getBoundingClientRect();
    if (top >= 0) {
      localStorage.setItem('feedVisibleLink', el.dataset.link || '');
      break;
    }
  }

  try {
    // 2. Persist to server and immediately restore state
    await saveStateToFile("appState.json");
    await restoreStateFromFile("appState.json");
    const hiddenItems = JSON.parse(localStorage.getItem(HIDDEN_KEY) || "[]");
    app.hidden = hiddenItems;
  } catch (err) {
    console.error("State save/restore failed:", err);
  }

  // 3. On next frame, scroll back into view
  window.requestAnimationFrame(() => {
    const link = localStorage.getItem('feedVisibleLink');
    if (link) {
      const target = document.querySelector(`.entry[data-link="${link}"]`);
      if (target) {
        target.scrollIntoView({ block: 'start' });
        return;
      }
    }
    const y = Number(localStorage.getItem('feedScrollY')) || 0;
    if (y) window.scrollTo({ top: y });
  });
}
