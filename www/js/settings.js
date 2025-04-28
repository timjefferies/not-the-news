// js/settings.js
import { saveStateToFile } from "./api.js";

const SYNC_KEY = "syncEnabled";

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

