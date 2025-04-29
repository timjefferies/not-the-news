import { restoreStateFromFile, saveStateToFile } from "./js/api.js";
import { scrollToTop, attachScrollToTopHandler, formatDate } from "./js/functions.js";
import { initSync, initTheme, initImages, initScrollPos } from "./js/settings.js";

window.rssApp = () => {
  const HIDDEN_KEY = "hidden";
  const STORAGE_ETAG = "feedEtag";
  const FEED_URL = '/feed.xml';
  return {
    openSettings: false, // Controls visibility of the settings modal
    entries: [],
    hidden: JSON.parse(localStorage.getItem(HIDDEN_KEY) || "[]"),
    imagesEnabled: JSON.parse(localStorage.getItem("imagesEnabled") ?? "true"),
    loading: true,

    // map-in our external helpers
    scrollToTop,                         // now uses imported scrollToTop()
    _attachScrollToTopHandler: attachScrollToTopHandler,
    formatDate,                         // now uses imported formatDate()

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
    },

    hide(link) {
      if (!this.hidden.includes(link)) {
        this.hidden.push(link);
        localStorage.setItem(HIDDEN_KEY, JSON.stringify(this.hidden));
        saveStateToFile("appState.json")
          .then(async () => {
            console.log("Synced hidden list to server.");
            // Pull back down so all tabs/devices stay in sync
            await restoreStateFromFile("appState.json");
            this.hidden = JSON.parse(localStorage.getItem(HIDDEN_KEY) || "[]");
          })
          .catch(err => console.error("Save failed:", err));
      }
    },
	  
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
        // keep the already-sanitized HTML instead of stripping it
        const raw = item.content
                 || item.contentSnippet
                 || item.summary
                 || item.description
                 || '';

	  // Extract the hostname from the link to use as the source
          let sourceHost = '';
          try {
            sourceHost = new URL(item.link).hostname;
          } catch (e) {
            console.warn('Could not parse URL for source:', item.link);
          }
	  // ✂︎ extract the first <img src="…"> from the HTML snippet
          let imageUrl = null;
          const imgMatch = raw.match(/<img[^>]+src="([^">]+)"/);
          if (imgMatch) {
            imageUrl = imgMatch[1];
          }

          return {
	    image:       imageUrl,
            title:       item.title,
            link:        item.link,
            pubDate:     this.formatDate(item.pubDate || item.isoDate || ''),
            description: raw.trim(),
	    source:      sourceHost
          };
        });

        this.entries = mapped.filter(e => !this.hidden.includes(e.link));

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
    },
  };
};
