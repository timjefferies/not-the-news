// functions.js
import { saveStateToFile, restoreStateFromFile } from "./api.js";

/**
 * Smooth-scroll back to top.
 */
export function scrollToTop() {
  window.scrollTo({ top: 0, behavior: "smooth" });
}

/**
 * Show “scroll to top” button on scroll, then hide it after idle.
 * @param {string} buttonId – the ID of your “scroll to top” button
 */
export function attachScrollToTopHandler(buttonId = "scroll-to-top") {
  const btn = document.getElementById(buttonId);
  if (!btn) return;

  let idleTimeout = null;
  window.addEventListener("scroll", () => {
    btn.classList.add("visible");
    clearTimeout(idleTimeout);
    idleTimeout = setTimeout(() => {
      btn.classList.remove("visible");
    }, 1200);
  });
}

/**
 * Format a date string relative to “now” (e.g. “3 hours ago”),
 * falling back to full date if over two weeks old.
 * @param {string} dateString
 * @returns {string}
 */
export function formatDate(dateString) {
  const now = new Date();
  const date = new Date(dateString);
  const diffInSeconds = Math.floor((now - date) / 1000);
  const twoWeeks = 2 * 7 * 24 * 60 * 60;

  if (diffInSeconds > twoWeeks) {
    return date.toLocaleString("en-GB", {
      weekday: "short", day: "numeric", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit"
    });
  }

  const minutes = Math.floor(diffInSeconds / 60);
  const hours   = Math.floor(minutes / 60);
  const days    = Math.floor(hours / 24);

  if (diffInSeconds < 60) {
    return "Just now";
  } else if (minutes < 60) {
    return `${minutes} minute${minutes !== 1 ? "s" : ""} ago`;
  } else if (hours < 24) {
    return `${hours} hour${hours !== 1 ? "s" : ""} ago`;
  } else if (days < 7) {
    return `${days} day${days !== 1 ? "s" : ""} ago`;
  } else {
    const weeks = Math.floor(days / 7);
    return `${weeks} week${weeks !== 1 ? "s" : ""} ago`;
  }
}


// key under which we persist the starred‐links array
const STARRED_KEY = "starred";

// -------- STARRED support --------
/**
 * @param {Object} state  The Alpine component `this`
 * @param {string} link
 * @returns {boolean}
 */
export function isStarred(state, link) {
  return state.starred.some(entry => entry.id === link);
}

/**
 * Toggle starred/unstarred for a given link, persist immediately
 */
export function toggleStar(state, link) {
  const idx = state.starred.findIndex(entry => entry.id === link);
  if (idx === -1) {
    state.starred.push({ id: link, starredAt: new Date().toISOString() });
  } else {
    state.starred.splice(idx, 1);
  }
  localStorage.setItem(STARRED_KEY, JSON.stringify(state.starred));
  saveStateToFile("appState.json").catch(err => console.error("Save failed:", err));
  // refresh filter counts in header
  if (typeof app.updateCounts === 'function') {
    app.updateCounts();
  }
}

/**
 * Change filterMode (e.g. via dropdown), persist choice
 */
export function setFilter(state, mode) {
  state.filterMode = mode;
  localStorage.setItem("filterMode", mode);
}

// key under which we persist the hidden‐links array
const HIDDEN_KEY = "hidden";

/**
 * Check if a given link is in the hidden list.
 * @param {object} app - The Alpine.js app instance.
 * @param {string} link - The URL to check.
 * @returns {boolean}
 */
export function isHidden(app, link) {
  return app.hidden.some(entry => entry.id === link);
}

/**
 * Toggle the hidden state of a given link.
 * Adds it if missing, removes it if present.
 * @param {object} app - The Alpine.js app instance.
 * @param {string} link - The URL to toggle.
 */
export async function toggleHidden(app, link) {
  // find existing entry by id
  const idx = app.hidden.findIndex(entry => entry.id === link);
  if (idx === -1) {
    // add new hidden object
    app.hidden.push({ id: link, hiddenAt: new Date().toISOString() });
  } else {
    // remove it
    app.hidden.splice(idx, 1);
  }
  localStorage.setItem(HIDDEN_KEY, JSON.stringify(app.hidden));
  try {
    await saveStateToFile("appState.json");
    await restoreStateFromFile("appState.json");
    // rehydrate & upgrade any legacy strings
    const raw = JSON.parse(localStorage.getItem(HIDDEN_KEY) || "[]");
    app.hidden = raw.map(item =>
      typeof item === "string"
        ? { id: item, hiddenAt: new Date().toISOString() }
        : item
    );
  } catch (err) {
    console.error("Save failed:", err);
  }
  // refresh filter counts in header
  if (typeof app.updateCounts === 'function') {
    app.updateCounts();
  }
}

/**
 * Recalculate and relabel each dropdown filter option with its current count.
 * @param {object} app - The Alpine app instance (this)
 */
export function updateCounts() {
  const allCount    = this.entries.length;
  const hiddenIds   = this.hidden.map(entry => entry.id);
  const starredIds = this.starred.map(s => typeof s === 'string' ? s : s.id);
  const hiddenCount = this.entries.filter(e => hiddenIds.includes(e.id)).length;
  const starredCount= this.entries.filter(e => this.starred.some(s => s.id === e.id)).length;
  // Exclude both hidden and starred so the three buckets are disjoint
  const unreadCount = this.entries.filter(e =>
    !hiddenIds.includes(e.id)
  ).length;
  const select = document.getElementById('filter-selector');
  if (!select) return;
  Array.from(select.options).forEach(opt => {
    switch (opt.value) {
      case 'all':
        opt.text = `All (${allCount})`;
        break;
      case 'hidden':
        opt.text = `Hidden (${hiddenCount})`;
        break;
      case 'starred':
        opt.text = `Starred (${starredCount})`;
        break;
      case 'unread':
        opt.text = `Unread (${unreadCount})`;
        break;
    }
  });
}

/**
 * Remove any IDs from localStorage “hidden” that no longer exist in the feed.
 * @param {Array<{id:string}>} entries  – array of current feed entries
 * @returns {{id:string,hiddenAt:string}[]}  – the pruned hidden list
 */
export function pruneStaleHidden(entries) {
   const raw = localStorage.getItem('hidden');
   let storedHidden = [];
   try {
     // Now we expect [{ id: string, hiddenAt: ISOString }, …]
     const parsed = raw ? JSON.parse(raw) : [];
     storedHidden = Array.isArray(parsed) ? parsed : [];
   } catch (err) {
     console.warn('pruneStaleHidden: invalid JSON, resetting hidden list', err);
     storedHidden = [];
   }
   // ─── guard: only prune on a healthy feed ───
   if (
     !Array.isArray(entries) ||
     entries.length === 0 ||
     // bail if any entry is missing a valid string id
     !entries.every(e => e && typeof e.id === 'string')
   ) {
     return storedHidden;
   }

   // optionally normalize ids: trim/case‐fold if your guids can shift case or whitespace
   const validIds = new Set(entries.map(e => e.id.trim().toLowerCase()));

   // threshold = 30 days in milliseconds
   const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
   const now = Date.now();

   // Keep items that are either still in the feed, or within the 30-day hold window
   const pruned = storedHidden.filter(item => {
     const idNorm = String(item.id).trim().toLowerCase();
     const keepBecauseInFeed = validIds.has(idNorm);
     if (keepBecauseInFeed) return true;

     // if not in feed, check age
     const hiddenAt = new Date(item.hiddenAt).getTime();
     const age = now - hiddenAt;
     return age < THIRTY_DAYS;
   });
   // Only write back if we've actually dropped anything
   if (pruned.length < storedHidden.length) {
     localStorage.setItem('hidden', JSON.stringify(pruned));
   }
   return pruned;
 }

/**
 * Fisher–Yates shuffle: returns the array randomly reordered.
 * @param {Array} arr
 * @returns {Array}
 */
export function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Hook shuffle-button into your Alpine/Vue component's shuffleFeed()
const shuffleBtn = document.getElementById('shuffle-button');
if (shuffleBtn) {
  shuffleBtn.addEventListener('click', () => {
    const appRoot = document.getElementById('app');
    if (appRoot && appRoot.__x) {
      // call the method you defined earlier in javascript.js
      appRoot.__x.$data.shuffleFeed();
    }
  });
}

/**
 * Handle a shuffle button press: decrement count, shuffle entries while
 * count > 0, update flags/counts, and scroll to top.
 * @param {Object} state  — the Alpine/Vue component instance (this)
 */
export function shuffleFeed(state) {
  if (state.shuffleCount > 0) {
    state.shuffleCount--;
    state.isShuffled = state.shuffleCount > 0;

    if (state.isShuffled) {
      // Shuffle entries in-place on a copy
      state.entries = shuffleArray(state.entries.slice());
    }

    state.updateCounts();
    state.scrollToTop();
  }
}
/**
 * Load hidden list from localStorage, preserving legacy string entries.
 * @returns {{id: string, hiddenAt: string}[]}
 */
export function loadHidden() {
  const raw = JSON.parse(localStorage.getItem("hidden") || "[]");
  return raw.map(item =>
    typeof item === "string"
      ? { id: item, hiddenAt: new Date().toISOString() }
      : item
  );
}

/**
 * Load starred list from localStorage, preserving legacy string entries.
 * @returns {string[]}
 */
export function loadStarred() {
  // load as objects {id, starredAt}, preserving legacy strings
  const raw = JSON.parse(localStorage.getItem(STARRED_KEY) || "[]");
  return raw.map(item =>
    typeof item === "string"
      ? { id: item, starredAt: new Date().toISOString() }
      : item
  );
}
