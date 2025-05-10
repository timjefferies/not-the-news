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

export function mapRawItems(rawList, formatDate) {
  return rawList.map(item => {
    const raw = item.desc || "";
    const parser = new DOMParser();
    const doc = parser.parseFromString(raw, "text/html");

    // 1) extract first image
    const imgElem = doc.querySelector("img");
    const imageUrl = imgElem ? imgElem.src : "";
    if (imgElem) imgElem.remove();

    // 2) extract first .source-url or <a>
    let sourceUrl = "";
    const sourceElem = doc.querySelector(".source-url") || doc.querySelector("a");
    if (sourceElem) {
      sourceUrl = sourceElem.textContent.trim();
      sourceElem.remove();
    } else {
      sourceUrl = item.link ? new URL(item.link).hostname : "";
    }

    // 3) remaining text
    const description = doc.body.innerHTML.trim();

    // 4) timestamp parse
    const timestamp = Date.parse(item.pubDate) || 0;

    return {
      id: item.guid,
      image: imageUrl,
      title: item.title,
      link: item.link,
      pubDate: formatDate(item.pubDate || ""),
      description,
      source: sourceUrl,
      timestamp,
    };
  }).sort((a, b) => b.timestamp - a.timestamp);
}
