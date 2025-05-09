import { dbPromise, performFullSync, pullUserState } from "./js/database.js";
import { scrollToTop, attachScrollToTopHandler, formatDate,
          isStarred, toggleStar,
          setFilter, updateCounts, pruneStaleHidden,
          shuffleFeed as handleShuffleFeed,
          loadHidden, loadStarred, loadFilterMode, isHidden, toggleHidden } from "./js/functions.js";
import { initSync, initTheme, initImages, initScrollPos, initConfigComponent,loadSyncEnabled, loadImagesEnabled } from "./js/settings.js";

window.rssApp = () => {
  return {
    openSettings: false, // Controls visibility of the settings modal
    entries: [],
    // will be populated in init():
    hidden:        [],
    starred:       [],
    filterMode:    null,
    imagesEnabled: null,
    syncEnabled:   null,
    isShuffled: false,              // Track whether we're in shuffled mode
    shuffleCount: 10,               // How many shuffles remain

    loading: true,

    // map-in our external helpers
    scrollToTop,
    _attachScrollToTopHandler: attachScrollToTopHandler,
    formatDate,
    updateCounts,
    isStarred(link)  { return isStarred(this, link); },
    toggleStar(link) { toggleStar(this, link); },
    setFilter(mode)  { setFilter(this, mode); },
    shuffleFeed() { handleShuffleFeed(this); },
      
    async init() {
      this.loading = true; //loading screen
      // 1) Apply theme & sync, then load persisted state
      this.syncEnabled   = await loadSyncEnabled();
      this.imagesEnabled = await loadImagesEnabled();
      initTheme();
      initSync(this);
      initImages(this);
      initConfigComponent(this);
      // 2) Load user‑state from IndexedDB
      this.hidden     = await loadHidden();
      this.starred    = await loadStarred();
      this.filterMode = await loadFilterMode();

      // 0) Initial sync + load from IndexedDB
      await pullUserState(await dbPromise);   // seed local userState from server
      let serverTime;
      try {
        // 1) sync both feed & user-state
        ({ feedTime: serverTime } = await performFullSync());
      // 2) load raw items
        const db      = await dbPromise;
        const rawList = await db.transaction('items', 'readonly')
                                 .objectStore('items')
                                 .getAll();
        // 3) transform each item like your old loadFeed did
        const mapped = rawList.map(item => {
          const raw = item.desc || '';
          // extract and strip <span class="source-url">
          let description = raw;
          let sourceUrl   = '';
          const spanMatch = description.match(
            /<span[^>]*class=["']source-url["'][^>]*>([\s\S]+?)<\/span>/
          );
          if (spanMatch) {
            sourceUrl   = spanMatch[1].trim();
            description = description.replace(
              /<span[^>]*class=["']source-url["'][^>]*>[\s\S]*?<\/span>/,
              ''
            ).trim();
          } else {
            sourceUrl = item.link ? new URL(item.link).hostname : '';
          }
          // find first <img src="…">
          let imageUrl = '';
          const imgMatch = raw.match(/<img[^>]+src="([^">]+)"/);
          if (imgMatch) imageUrl = imgMatch[1];
          // strip any remaining <img> tags
          const descText = description.replace(/<img[^>]*>/g, '').trim();
          return {
            id:          item.guid,
            image:       imageUrl,
            title:       item.title,
            link:        item.link,
            pubDate:     this.formatDate(item.pubDate || ''),
            description: descText,
            source:      sourceUrl
          };
        });
        this.entries = mapped;
        // restore previous scroll position once entries are rendered
        initScrollPos(this);
        } catch (err) {
        console.error("loadFeed failed", err);
        this.errorMessage = "Could not load feed.";
      } finally {
        this.loading = false;
      }
      this.updateCounts();
      setInterval(async () => {
        // don’t sync while in settings or if disabled
        if (this.openSettings || !this.syncEnabled) return;
         try {
          await performSync();
        } catch (err) {
          console.error("performSync failed", err);
        }
      }, 5 * 60 * 1000);
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
    const currentHash = `${this.entries.length}-${this.filterMode}-${this.hidden.length}-${this.starred.length}`;
    
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
        case "all":     return true;
        case "unread":  return !hiddenSet.has(entry.id);
        case "hidden":  return hiddenSet.has(entry.id);
        case "starred": return starredSet.has(entry.id);
        default:        return true;
      }
    });
    
    this._lastFilterHash = currentHash;
    return this._cachedFilteredEntries;
  }
} 
    document.addEventListener("load", e => {
      if (e.target.tagName.toLowerCase() === "img") {
        e.target.classList.add("loaded");
      }
    }, true);
};
