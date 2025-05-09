// functions.js
import { dbPromise } from "./database.js";

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
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

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
export async function toggleStar(state, link) {
  const idx = state.starred.findIndex(entry => entry.id === link);
  if (idx === -1) {
    state.starred.push({ id: link, starredAt: new Date().toISOString() });
  } else {
    state.starred.splice(idx, 1);
  }
  // persist updated starred list to IDB
  const db = await dbPromise;
  const tx = db.transaction("userState", "readwrite");
  tx.objectStore("userState").put({ key: "starred", value: JSON.stringify(state.starred) });
  await tx.done;
  // refresh filter counts in header
  if (typeof state.updateCounts === 'function') {
    state.updateCounts();
  }
  // fire off single‐item delta for starred
  await fetch("/user-state/starred/delta", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        id: link,
        action: idx === -1 ? "add" : "remove",
        starredAt: idx === -1 ? new Date().toISOString() : undefined
      })
    });
}

/**
 * Change filterMode (e.g. via dropdown), persist choice
 */
export async function setFilter(state, mode) {
  state.filterMode = mode;
  // persist filterMode to IDB
  const db = await dbPromise;
  const tx = db.transaction("userState", "readwrite");
  tx.objectStore("userState").put({ key: "filterMode", value: mode });
  await tx.done;
}

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
export async function toggleHidden(state, link) {
  const idx = state.hidden.findIndex(entry => entry.id === link);
  if (idx === -1) {
    // add new hidden object
    state.hidden.push({ id: link, hiddenAt: new Date().toISOString() });
  } else {
    // remove it
    state.hidden.splice(idx, 1);
  }
  // persist hidden list to IDB
  const db = await dbPromise;
  const tx = db.transaction("userState", "readwrite");
  tx.objectStore("userState").put({ key: "hidden", value: JSON.stringify(app.hidden) });
  await tx.done;
  if (typeof state.updateCounts === 'function') {
    state.updateCounts();
  }
  // fire off single‐item delta for hidden
  await fetch("/user-state/hidden/delta", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({
      id: link,
      action: idx === -1 ? "add" : "remove",
      hiddenAt: idx === -1 ? new Date().toISOString() : undefined
    })
  });
}

/**
 * Recalculate and relabel each dropdown filter option with its current count.
 * @param {object} app - The Alpine app instance (this)
 */
export function updateCounts() {
  const hiddenSet = new Set(this.hidden.map(entry => entry.id));
  const starredSet = new Set(this.starred.map(s => s.id));

  const allCount = this.entries.length;
  const hiddenCount = this.entries.filter(e => hiddenSet.has(e.id)).length;
  const starredCount = this.entries.filter(e => starredSet.has(e.id)).length;
  const unreadCount = allCount - hiddenCount;

  const select = document.getElementById('filter-selector');
  if (!select) return;
  Array.from(select.options).forEach(opt => {
    switch (opt.value) {
      case 'all': opt.text = `All (${allCount})`; break;
      case 'hidden': opt.text = `Hidden (${hiddenCount})`; break;
      case 'starred': opt.text = `Starred (${starredCount})`; break;
      case 'unread': opt.text = `Unread (${unreadCount})`; break;
    }
  });
}

/**
 * Remove any IDs from IndexedDB “hidden” that no longer exist in the feed.
 * @param {Array<{id:string}>} entries  – array of current feed entries
 * @returns {Promise<{id:string,hiddenAt:string}[]>}  – the pruned hidden list
 */
export async function pruneStaleHidden(entries, serverTime) {
  const db = await dbPromise;
  const entry = await db.transaction('userState', 'readonly')
    .objectStore('userState')
    .get('hidden');
  // Normalize storedHidden: may be a JSON string or raw array
  let storedHidden = [];
  if (entry && entry.value != null) {
    if (typeof entry.value === 'string') {
      try {
        storedHidden = JSON.parse(entry.value);
      } catch {
        storedHidden = [];
      }
    } else if (Array.isArray(entry.value)) {
      storedHidden = entry.value;
    }
  }
  // Ensure we have an array
  if (!Array.isArray(storedHidden)) storedHidden = [];
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
  const now = serverTime;

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
    const tx = db.transaction('userState', 'readwrite');
    tx.objectStore('userState').put({ key: 'hidden', value: JSON.stringify(pruned) });
    await tx.done;
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
 * Load hidden list from indexedDB
 * @returns {{id: string, hiddenAt: string}[]}
 */
export async function loadHidden() {
  // load hidden list from IDB
  const db = await dbPromise;
  const entry = await db.transaction("userState", "readonly")
    .objectStore("userState")
    .get("hidden");
  // Parse and coerce into an array, even if malformed or missing
  let raw = [];
  if (entry && entry.value != null) {
    // entry.value may be JSON or an array
    if (typeof entry.value === 'string') {
      try {
        raw = JSON.parse(entry.value);
      } catch (e) {
        console.warn('loadHidden: invalid JSON in entry.value', entry.value);
        raw = [];
      }
    } else if (Array.isArray(entry.value)) {
      raw = entry.value;
    }
  }
  if (!Array.isArray(raw)) {
    console.warn('loadHidden: expected array but got', raw);
    raw = [];
  }
  return raw.map(item =>
    typeof item === "string"
      ? { id: item, hiddenAt: new Date().toISOString() }
      : item
  );
}

/**
 * Load starred list from indexedDB.
 * @returns {string[]}
 */
export async function loadStarred() {
  // load starred list from IDB
  const db = await dbPromise;
  const entry = await db.transaction("userState", "readonly")
    .objectStore("userState")
    .get("starred");
  // Parse and coerce into an array, even if malformed or missing
  let raw = [];
  if (entry && entry.value) {
    try {
      raw = JSON.parse(entry.value);
    } catch (e) {
      console.warn('loadStarred: invalid JSON in entry.value', entry.value);
      raw = [];
    }
  }
  if (!Array.isArray(raw)) {
    console.warn('loadStarred: expected array but got', raw);
    raw = [];
  }
  return raw.map(item =>
    typeof item === "string"
      ? { id: item, starredAt: new Date().toISOString() }
      : item
  );
}

/**
 * Load the saved filterMode from IDB (fallback to 'all').
 * @returns {Promise<string>}
 */
export async function loadFilterMode() {
  const db = await dbPromise;
  const entry = await db.transaction('userState', 'readonly')
    .objectStore('userState')
    .get('filterMode');
  return entry?.value ?? 'unread';
}
