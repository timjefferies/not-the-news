// functions.js
import { saveStateToFile } from "./api.js";

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
  return state.starred.includes(link);
}

/**
 * Toggle starred/unstarred for a given link, persist immediately
 */
export function toggleStar(state, link) {
  if (state.starred.includes(link)) {
    state.starred = state.starred.filter(l => l !== link);
  } else {
    state.starred.push(link);
  }
  localStorage.setItem(STARRED_KEY, JSON.stringify(state.starred));
  saveStateToFile("appState.json").catch(err => console.error("Save failed:", err));
}

/**
 * Change filterMode (e.g. via dropdown), persist choice
 */
export function setFilter(state, mode) {
  state.filterMode = mode;
  localStorage.setItem("filterMode", mode);
}
