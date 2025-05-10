import { dbPromise, bufferedChanges, pushUserState, performSync, performFullSync, pullUserState } from "./js/database.js";
import {
  scrollToTop, attachScrollToTopHandler, formatDate,
  isStarred, toggleStar,
  setFilter, updateCounts, pruneStaleHidden,
  shuffleFeed as handleShuffleFeed,
  loadHidden, loadStarred, loadFilterMode, isHidden, toggleHidden
} from "./js/functions.js";
import { initSync, initTheme, initImages, initScrollPos, initConfigComponent, loadSyncEnabled, loadImagesEnabled } from "./js/settings.js";

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
      // ensure serverTime always exists
      let serverTime = 0;
      try {
        // 1) Apply theme & sync, then load persisted state
        this.syncEnabled = await loadSyncEnabled();
        this.imagesEnabled = await loadImagesEnabled();
        initTheme();
        initSync(this);
        initImages(this);
        initConfigComponent(this);
        // 2) Load user‑state from IndexedDB
        this.hidden = await loadHidden();
        this.starred = await loadStarred();
        this.filterMode = await loadFilterMode();

        // 0) Sync: full only on empty DB, otherwise feed‐diff + user‐state pull
        const db = await dbPromise;
        const count = await db.transaction('items', 'readonly').objectStore('items').count();
        let serverTime;
        if (count === 0) {
          // first run: full feed+user‑state pull from server
          const { feedTime } = await performFullSync();
          serverTime = feedTime;
        } else {
          serverTime = Date.now();
        }
        this.hidden = await loadHidden();
        this.starred = await loadStarred();
        // 2) load raw items, map & attach a numeric timestamp
        const rawList = await db.transaction('items', 'readonly')
          .objectStore('items')
          .getAll();
        const mapped = rawList.map(item => {
          const raw = item.desc || '';
          // parse the HTML snippet properly
          const parser = new DOMParser();
          const doc = parser.parseFromString(raw, 'text/html');
          // 1) extract and remove the first <img>
          const imgElem = doc.querySelector('img');
          const imageUrl = imgElem ? imgElem.src : '';
          if (imgElem) imgElem.remove();
          // 2) extract and remove the first .source-url span or <a>
          let sourceUrl = '';
          const sourceElem = doc.querySelector('.source-url') || doc.querySelector('a');
          if (sourceElem) {
            sourceUrl = sourceElem.textContent.trim();
            sourceElem.remove();
          } else {
            sourceUrl = item.link ? new URL(item.link).hostname : '';
          }
          // 3) whatever remains is your clean text
          const descText = doc.body.textContent.trim();
          // 4) parse timestamp
          const timestamp = Date.parse(item.pubDate) || 0;
          return {
            id: item.guid,
            image: imageUrl,
            title: item.title,
            link: item.link,
            pubDate: this.formatDate(item.pubDate || ''),
            description: descText,
            source: sourceUrl,
            timestamp,  // preserve for sorting
          };
        });
        // 3) sort mapped entries by timestamp descending (newest first)
        mapped.sort((a, b) => b.timestamp - a.timestamp);

        // 4) assign your sorted feed
        this.entries = mapped;
        // restore previous scroll position once entries are rendered
        initScrollPos(this);
        this.updateCounts();

        this.loading = false;
        // 3) kick off one‑off background partial sync
        if (this.syncEnabled) {
          setTimeout(async () => {
            try {
              const newServerTime = await performSync();
              await pullUserState(await dbPromise);
              // re‑load & re‑render the updated items
              const freshRaw = await db.transaction('items', 'readonly').objectStore('items').getAll();
              const freshMapped = freshRaw.map(/* same mapping logic */);
              freshMapped.sort((a, b) => b.timestamp - a.timestamp);
              this.entries = freshMapped;
              this.updateCounts();
            } catch (err) {
              console.error('Background partial sync failed', err);
            }
          }, 0);
        }
        setInterval(async () => {
          // don’t sync while in settings or if disabled
          if (this.openSettings || !this.syncEnabled) return;
          try {
            await performSync();
            await pullUserState(await dbPromise);
            this.hidden = await pruneStaleHidden(this.entries, serverTime);
          } catch (err) {
            console.error("Partial sync failed", err);
          }
        }, 5 * 60 * 1000);
        this._attachScrollToTopHandler();
      } catch (err) {
        console.error("loadFeed failed", err);
        this.errorMessage = "Could not load feed.";
      } finally {
        this.loading = false;
      }
      this._attachScrollToTopHandler();
      this.hidden = await pruneStaleHidden(this.entries, serverTime)
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
