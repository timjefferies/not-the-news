if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js')
    .then(reg => {
      console.log('SW registered:', reg.scope);
      // when a new SW is found, reload once it's activated
      reg.addEventListener('updatefound', () => {
        const newSW = reg.installing;
        newSW.addEventListener('statechange', () => {
          if (newSW.state === 'activated') {
            window.location.reload();
          }
        });
      });
    })
    .catch(err => console.warn('SW registration failed:', err));
}

import {
  dbPromise, bufferedChanges, pushUserState, performSync, performFullSync, pullUserState, processPendingOperations,
  isStarred, toggleStar, isHidden, toggleHidden, loadHidden, loadStarred, pruneStaleHidden, saveLastFeedSyncTimestamp, loadLastFeedSyncTimestamp
} from "./js/database.js";
import {
  scrollToTop, attachScrollToTopHandler, formatDate,
  setFilter, updateCounts, loadFilterMode,
  shuffleFeed as handleShuffleFeed, mapRawItems
} from "./js/functions.js";
import { initSync, initTheme, initImages, initScrollPos, initConfigComponent, loadSyncEnabled, loadImagesEnabled } from "./js/settings.js";

const STALENESS_THRESHOLD_HOURS = 1; // Sync if data is older than 1 hour
// const STALENESS_THRESHOLD_HOURS = 0.001; // For testing: ~3 seconds

window.rssApp = () => {
  return {
    openSettings: false, // Controls visibility of the settings modal
    entries: [],
    isOnline: navigator.onLine, // start with current network status
    hidden: [],
    starred: [],
    filterMode: "unread",
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

    async triggerSyncAndRefresh(isFullSync = false, reason = "generic") {
      if (!this.isOnline) {
        console.log(`Sync skipped (offline) - ${reason}`);
        // Attempt to use the last known sync time for pruning if offline
        const db = await dbPromise;
        return await loadLastFeedSyncTimestamp(db) || Date.now();
      }
      // Allow full sync for first run even if general sync is disabled
      if (!this.syncEnabled && !(isFullSync && reason.includes("initial"))) {
        console.log(`Sync skipped (sync disabled) - ${reason}`);
        const db = await dbPromise;
        return await loadLastFeedSyncTimestamp(db) || Date.now();
      }

      console.log(`Triggering sync (${isFullSync ? 'full' : 'partial'}) - ${reason}`);
      this.loading = true;
      let newServerTime;
      const db = await dbPromise;

      try {
        if (isFullSync) {
          const { feedTime } = await performFullSync(); // This also calls pullUserState
          newServerTime = feedTime;
        } else {
          newServerTime = await performSync();
          await pullUserState(db); // Manually pull user state after partial feed sync
        }
        await saveLastFeedSyncTimestamp(db, newServerTime);

        // Refresh local data from DB
        this.hidden = await loadHidden();
        this.starred = await loadStarred();
        const freshRaw = await db.transaction('items', 'readonly').objectStore('items').getAll();
        this.entries = mapRawItems(freshRaw, this.formatDate);
        // Use the time from this sync for pruning
        this.hidden = await pruneStaleHidden(this.entries, newServerTime);
        this.updateCounts();
        console.log(`Sync successful - ${reason}. Server time: ${new Date(newServerTime).toISOString()}`);
        return newServerTime;
      } catch (err) {
        console.error(`Sync failed - ${reason}:`, err);
        const lastKnownSyncTime = await loadLastFeedSyncTimestamp(db);
        return lastKnownSyncTime || Date.now(); // Fallback for pruning
      } finally {
        this.loading = false;
      }
    },

    async checkStaleAndSyncOnResume(reason = "resume") {
      if (!this.isOnline || !this.syncEnabled || document.hidden) { // Check document.hidden again for safety
        if(document.hidden) console.log(`Skipping sync on ${reason}: document is hidden.`);
        return;
      }

      const db = await dbPromise;
      const lastFeedSyncTime = await loadLastFeedSyncTimestamp(db);
      const now = Date.now();
      const stalenessThresholdMs = STALENESS_THRESHOLD_HOURS * 60 * 60 * 1000;

      if (!lastFeedSyncTime || (now - lastFeedSyncTime) > stalenessThresholdMs) {
        await this.triggerSyncAndRefresh(false, `stale data on ${reason}`);
      } else {
        console.log(`App ${reason}, data is fresh enough (last sync: ${lastFeedSyncTime ? new Date(lastFeedSyncTime).toISOString() : 'never'}).`);
      }
    },

    async init() {
      this.loading = true; //loading screen
      const db = await dbPromise;
      let currentServerTimeForPruning = Date.now(); // Fallback/initial server time for pruning

      try {
        this.syncEnabled = await loadSyncEnabled();
        this.imagesEnabled = await loadImagesEnabled();
        initTheme();
        initSync(this); // Be cautious if initSync calls app.init() - can cause loops.
        initImages(this);
        initConfigComponent(this);

        this.hidden = await loadHidden();
        this.starred = await loadStarred();

        const count = await db.transaction('items', 'readonly').objectStore('items').count();
        const lastFeedSyncTime = await loadLastFeedSyncTimestamp(db);

        if (count === 0 && this.isOnline) {
          currentServerTimeForPruning = await this.triggerSyncAndRefresh(true, "initial empty DB");
        } else if (this.isOnline && this.syncEnabled) {
          const now = Date.now();
          const stalenessThresholdMs = STALENESS_THRESHOLD_HOURS * 60 * 60 * 1000;
          if (!lastFeedSyncTime || (now - lastFeedSyncTime) > stalenessThresholdMs) {
            currentServerTimeForPruning = await this.triggerSyncAndRefresh(false, "stale data on load");
          } else {
            console.log("Data is fresh enough on load. Using local data.");
            currentServerTimeForPruning = lastFeedSyncTime || Date.now();
            const rawList = await db.transaction('items', 'readonly').objectStore('items').getAll();
            this.entries = mapRawItems(rawList, this.formatDate);
          }
        } else {
          console.log("Offline, sync disabled, or data fresh. Using local data.");
          currentServerTimeForPruning = lastFeedSyncTime || Date.now();
          const rawList = await db.transaction('items', 'readonly').objectStore('items').getAll();
          this.entries = mapRawItems(rawList, this.formatDate);
        }

        // Common post-load/sync steps
        this.hidden = await pruneStaleHidden(this.entries, currentServerTimeForPruning);
        this.updateCounts();
        initScrollPos(this);

        // Network listeners
        window.addEventListener('online', () => {
          this.isOnline = true;
          if (this.syncEnabled && typeof this.syncPendingChanges === 'function') {
            this.syncPendingChanges();
          }
          this.checkStaleAndSyncOnResume("became online");
        });
        window.addEventListener('offline', () => { this.isOnline = false; });

        this._attachScrollToTopHandler();

        // User activity / idle detection & periodic sync
        let lastActivity = Date.now();
        const resetActivity = () => { lastActivity = Date.now(); };

        ["mousemove", "mousedown", "keydown", "scroll", "click"]
          .forEach(evt => document.addEventListener(evt, resetActivity, true));

        document.addEventListener("visibilitychange", () => {
          resetActivity();
          if (document.visibilityState === 'visible') {
            this.checkStaleAndSyncOnResume("tab became visible");
          }
        }, true);

        window.addEventListener("focus", () => {
          resetActivity();
          this.checkStaleAndSyncOnResume("window gained focus");
        }, true);

        const SYNC_INTERVAL = 5 * 60 * 1000;
        const IDLE_THRESHOLD = 60 * 1000;

        setInterval(async () => {
          const now = Date.now();
          if (this.openSettings || !this.syncEnabled || document.hidden || (now - lastActivity) > IDLE_THRESHOLD) {
            return;
          }
          await this.triggerSyncAndRefresh(false, "periodic background sync");
        }, SYNC_INTERVAL);

      } catch (err) {
        console.error("App init failed:", err);
        this.errorMessage = "Could not initialize application: " + err.message;
      } finally {
        this.loading = false;
      }
    },
    async syncPendingChanges() {
      if (!this.isOnline) return;
      try {
        await processPendingOperations();
      } catch (err) {
        console.error('syncPendingChanges failed', err);
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
