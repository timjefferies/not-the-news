import { scrollToTop, attachScrollToTopHandler, formatDate,
          isHidden, toggleHidden, isStarred, toggleStar,
          setFilter, updateCounts, pruneStaleHidden,
          shuffleArray, shuffleFeed as handleShuffleFeed,
          loadHidden, loadStarred, loadFilterMode } from "./js/functions.js";
import { initSync, initTheme, initImages, initScrollPos, initConfigComponent,loadSyncEnabled, loadImagesEnabled } from "./js/settings.js";
import { dbPromise, performSync } from "./js/database.js";

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

      // 0) Kick off IndexedDB‑based sync loop
      // // Load the feed
      try {
  await this.loadFeed(/* no ETag headers; fully controlled by IndexedDB sync */);
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
      this.hidden = await pruneStaleHidden(this.entries);
    },
    isHidden(link) { return isHidden(this, link); },
    toggleHidden(link) { toggleHidden(this, link); },
	  
    async loadFeed({ showLoading = false } = {}) {
      if (showLoading) this.loading = true;
      this.errorMessage = null;

        const xml    = await res.text();
        const parser = new RSSParser();
        const feed   = await parser.parseString(xml);

	const mapped = feed.items.map(item => {
	const uniqueKey = item.guid || item.id || item.link;
        // keep the already-sanitized HTML instead of stripping it
        const raw = item.description
                 || item.content
                 || item.contentSnippet
                 || item.summary
                 || '';

	  let description = raw;
	  let sourceUrl = null;
	  const m = description.match(/<span[^>]*class=["']source-url["'][^>]*>([\s\S]+?)<\/span>/);
	  if (m) {
	    sourceUrl  = m[1].trim();
	    description = description.replace(/<span[^>]*class=["']source-url["'][^>]*>[\s\S]*?<\/span>/, '').trim();
          }
	  else sourceUrl = new URL(item.link).hostname;
          let imageUrl = null;
          const imgMatch = raw.match(/<img[^>]+src="([^">]+)"/);
          if (imgMatch) {
            imageUrl = imgMatch[1];
          }
	  else imageUrl = '';
	  // Remove <img> tags from raw content
	  const descText = description.replace(/<img[^>]*>/g, '').trim();

          return {
	    id:		 uniqueKey,
	    image:       imageUrl,
            title:       item.title,
            link:        item.link,
            pubDate:     this.formatDate(item.pubDate || item.isoDate || ''),
            description: descText,
	    source:      sourceUrl
          };
        });

        // always store full list; filter in computed getter
        this.entries = mapped;
	this.updateCounts(); // after entries refresh, update dropdown labels

	// After setting entries:
  	this._lastFilterHash = "";  // Reset cache
  	this._cachedFilteredEntries = null;
      } catch (err) {
        console.error('Failed to load feed:', err);
        this.errorMessage = 'Error loading feed.';
      } finally {
        if (showLoading) this.loading = false;
      }
      initScrollPos(this);
      this.$nextTick?.(() => {
        document.querySelectorAll(".entry img").forEach(img => {
          // if already cached, mark immediately
          if (img.complete) {
            img.classList.add("loaded");
          } else {
            img.addEventListener("load", () => {
              img.classList.add("loaded");
            });
          }
        });
      });
    },
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
