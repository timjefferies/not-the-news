import { restoreStateFromFile, saveStateToFile } from "./js/api.js";
import { scrollToTop, attachScrollToTopHandler, formatDate, isHidden, toggleHidden, isStarred, toggleStar, setFilter, updateCounts, pruneStaleHidden, shuffleArray, shuffleFeed as handleShuffleFeed } from "./js/functions.js";
import { initSync, initTheme, initImages, initScrollPos, initConfigComponent } from "./js/settings.js";

window.rssApp = () => {
  const HIDDEN_KEY = "hidden";
  const STARRED_KEY = "starred";
  const STORAGE_ETAG = "feedEtag";
  const FEED_URL = '/feed.xml';
  return {
    openSettings: false, // Controls visibility of the settings modal
    filterMode: 'unread', // Defaults to unread
    entries: [],
    hidden: JSON.parse(localStorage.getItem(HIDDEN_KEY) || "[]"),
    starred: JSON.parse(localStorage.getItem(STARRED_KEY) || "[]"),
    imagesEnabled: JSON.parse(localStorage.getItem("imagesEnabled") ?? "true"),
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
      // 1) Restore persisted state *before* initializing UI
      try {
        await restoreStateFromFile("appState.json");
        console.log("State restored.");
      } catch {
        console.warn("No previous state to restore.");
      }
      // 2) Now apply theme & hidden list & sync
      this.hidden = JSON.parse(localStorage.getItem(HIDDEN_KEY) || "[]");
      this.syncEnabled = JSON.parse(localStorage.getItem("syncEnabled") ?? "true");
      this.imagesEnabled = JSON.parse(localStorage.getItem("imagesEnabled") ?? "true"),
      initTheme();
      initSync(this);
      initImages(this);
      initConfigComponent(this);

      // 0) Initialize our ETag/Last-Modified validators so the very first poll
      //    can send If-None-Match right away
      let lastEtag     = localStorage.getItem(STORAGE_ETAG);
      let lastModified = null;
        
      // Load the feed
      try {
	await this.loadFeed({ showLoading: true });
  	} catch (err) {
    	  console.error("loadFeed failed", err);
    	  this.errorMessage = "Could not load feed.";
  	} finally {
    	  this.loading = false;
  	}
      this.updateCounts();

      setInterval(async () => {
	// don’t do any feed work if settings modal is open or sync is off
        if (this.openSettings) return;
	if (!this.syncEnabled) return;

        // 1. Send HEAD with validators if available
	const headRes = await fetch(FEED_URL, {
          method: 'HEAD',
          headers: {
            ...(lastEtag       && { 'If-None-Match': lastEtag }),
            ...(lastModified   && { 'If-Modified-Since': lastModified })
          }
        });
        // 2a. If changed, update validators and fetch full feed
        if (headRes.status === 200) {
          // update both validators
          lastEtag     = headRes.headers.get('ETag');          // ← newly added
          lastModified = headRes.headers.get('Last-Modified'); // ← existing

	  await this.loadFeed({ showLoading: false });
        }
        // 2b. If 304, feed unchanged—do nothing
      }, 5*60*1000);
      this._attachScrollToTopHandler();
      // prune any stale hidden-IDs
      this.hidden = pruneStaleHidden(this.entries);
    },
    isHidden(link) { return isHidden(this, link); },
    toggleHidden(link) { toggleHidden(this, link); },
	  
    async loadFeed({ showLoading = false } = {}) {
      if (showLoading) this.loading = true;
      this.errorMessage = null;

      const prevEtag = localStorage.getItem(STORAGE_ETAG);
      const headers  = {};

      if (prevEtag && this.entries.length > 0) {
        headers['If-None-Match'] = prevEtag;
      }

      try {
        const res = await fetch(FEED_URL, { method: 'GET', headers });

        if (res.status === 304) {
          console.log('Feed not modified');
          return;
        }

        if (!res.ok) {
          this.errorMessage = res.status === 404
            ? 'Feed not found (404).'
            : `Feed request failed with status ${res.status}.`;
          return;
        }

        const xml    = await res.text();
        const parser = new RSSParser();
        const feed   = await parser.parseString(xml);

	const mapped = feed.items.map(item => {
	const uniqueKey = item.guid || item.id || item.link;
        // keep the already-sanitized HTML instead of stripping it
        const raw = item.content
                 || item.contentSnippet
                 || item.summary
                 || item.description
                 || '';

	  let description = raw;
	  let sourceUrl = null;
	  const m = description.match(/^<!--<source-url>([\s\S]+?)<\/source-url>-->/);
	  if (m) {
            sourceUrl  = m[1].trim();
            description = description.replace(/^<!--<source-url>[\s\S]+?<\/source-url>-->/, '').trim();
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

        const newEtag = res.headers.get('ETag');
        if (newEtag) {
          localStorage.setItem(STORAGE_ETAG, newEtag);
        }
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
    get filteredEntries() {
      return this.entries.filter(entry => {
        if (this.filterMode === 'all')   return true;
        if (this.filterMode === 'unread') return !this.hidden.includes(entry.id);
        if (this.filterMode === 'hidden') return  this.hidden.includes(entry.id);
        if (this.filterMode === 'starred') return  this.starred.includes(entry.id);
        return true;
      });
    document.addEventListener("load", e => {
      if (e.target.tagName.toLowerCase() === "img") {
        e.target.classList.add("loaded");
      }
    }, true);
      
    }
  };
};
