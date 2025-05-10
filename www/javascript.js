import { dbPromise, bufferedChanges, pushUserState, performSync, performFullSync, pullUserState } from "./js/database.js";
import {
  scrollToTop, attachScrollToTopHandler, formatDate,
  isStarred, toggleStar,
  setFilter, updateCounts, pruneStaleHidden,
  shuffleFeed as handleShuffleFeed,
  loadHidden, loadStarred, loadFilterMode, isHidden, toggleHidden
} from "./js/functions.js";
import { initSync, initTheme, initImages, initScrollPos, initConfigComponent, loadSyncEnabled, loadImagesEnabled } from "./js/settings.js";

function mapRawItems(rawList, formatDate) {
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

window.rssApp = () => {
  return {
    openSettings: false, // Controls visibility of the settings modal
    entries: [],
    // will be populated in init():
    hidden: [],
    starred: [],
    filterMode: null,
    imagesEnabled: null,
    syncEnabled: null,
    isShuffled: false,              // Track whether we're in shuffled mode
    shuffleCount: 10,               // How many shuffles remain

    loading: true,

    // map-in our external helpers
    scrollToTop,
    _attachScrollToTopHandler: attachScrollToTopHandler,
    formatDate,
    updateCounts,
    isStarred(link) { return isStarred(this, link); },
    toggleStar(link) { toggleStar(this, link); },
    setFilter(mode) { setFilter(this, mode); },
    shuffleFeed() { handleShuffleFeed(this); },

    async init() {
      this.loading = true; //loading screen
      let serverTime = 0;
      try {
        this.syncEnabled = await loadSyncEnabled();
        this.imagesEnabled = await loadImagesEnabled();
        initTheme();
        initSync(this);
        initImages(this);
        initConfigComponent(this);
        // Load user‑state from IndexedDB
        this.hidden = await loadHidden();
        this.starred = await loadStarred();
        this.filterMode = await loadFilterMode();

        // 0) Full Sync On empty DB
        const db = await dbPromise;
        const count = await db.transaction('items', 'readonly').objectStore('items').count();
        if (count === 0) {
          // first run: full feed+user‑state pull from server
          const { feedTime } = await performFullSync();
          serverTime = feedTime;
          this.hidden  = await loadHidden();
          this.starred = await loadStarred();
        } else {
          serverTime = Date.now();
        }
        // 1) Load items from indexedDB and map/sort via helper
        const rawList = await db.transaction('items', 'readonly').objectStore('items').getAll();
        this.entries = mapRawItems(rawList, this.formatDate);
        this.hidden = await pruneStaleHidden(this.entries, serverTime);
        initScrollPos(this); // restore previous scroll position once entries are rendered
        this.updateCounts(); // update dropdown
        this.loading = false;
        // 2) kick off one‑off background partial sync
        if (this.syncEnabled) {
          setTimeout(async () => {
            try {
              await performSync();
              await pullUserState(await dbPromise);
              this.hidden = await loadHidden();
              this.starred = await loadStarred();
              // re‑load & re‑render using helper
              const freshRaw = await db.transaction('items', 'readonly').objectStore('items').getAll();
              this.entries = mapRawItems(freshRaw, this.formatDate);
              this.hidden = await pruneStaleHidden(this.entries, Date.now());
              this.updateCounts();
            } catch (err) {
              console.error('Background partial sync failed', err);
            }
          }, 0);
        }
        this._attachScrollToTopHandler();
        // ─── user activity / idle detection ───────────────────────────
        let lastActivity = Date.now();
        const resetActivity = () => { lastActivity = Date.now(); };
        // listen for any “activity” events
        ["mousemove", "mousedown", "keydown", "scroll", "click"]
          .forEach(evt => document.addEventListener(evt, resetActivity, true));
        document.addEventListener("visibilitychange", resetActivity, true);
        window.addEventListener("focus", resetActivity, true);

        const SYNC_INTERVAL = 5 * 60 * 1000;  // 5 min default sync cycle
        const IDLE_THRESHOLD = 60 * 1000;      // 1 min of no activity → skip sync

        setInterval(async () => {
          const now = Date.now();
          if ( // if settings open, sync off, page hidden, or idle → bail
            this.openSettings ||
            !this.syncEnabled ||
            document.hidden ||
            (now - lastActivity) > IDLE_THRESHOLD
          ) {
            return;
          }
          try {
            await performSync();
            await pullUserState(await dbPromise);
            this.hidden = await pruneStaleHidden(this.entries, now);
          } catch (err) {
            console.error("Partial sync failed", err);
          }
        }, SYNC_INTERVAL);
      } catch (err) {
        console.error("loadFeed failed", err);
        this.errorMessage = "Could not load feed.";
      } finally {
      // nothing left to do here
      }
    },
    isHidden(link) { return isHidden(this, link); },
    toggleHidden(link) { return toggleHidden(this, link); },

    // computed, based on our three modes + the hidden[] list
    _lastFilterHash: "",
    _cachedFilteredEntries: null,  // Initialize as null instead of empty array

    // Modified getter
    get filteredEntries() {
      // Include entries.length in the hash to detect initial load
      const currentHash = `${this.entries.length}-${this.filterMode}-${this.hidden.length}-${this.starred.length}-${this.imagesEnabled}`;

      // Return cached value only if we have entries and hash matches
      if (this.entries.length > 0 &&
        currentHash === this._lastFilterHash &&
        this._cachedFilteredEntries !== null) {
        return this._cachedFilteredEntries;
      }

      // Existing filter logic
      const hiddenSet = new Set(this.hidden.map(h => h.id));
      const starredSet = new Set(this.starred.map(s => s.id));

      this._cachedFilteredEntries = this.entries.filter(entry => {
        switch (this.filterMode) {
          case "all": return true;
          case "unread": return !hiddenSet.has(entry.id);
          case "hidden": return hiddenSet.has(entry.id);
          case "starred": return starredSet.has(entry.id);
          default: return true;
        }
      });

      this._lastFilterHash = currentHash;
      return this._cachedFilteredEntries;
    }
  }
};
document.addEventListener("load", e => {
  if (e.target.tagName.toLowerCase() === "img") {
    e.target.classList.add("loaded");
  }
}, true);
