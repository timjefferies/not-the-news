window.rssApp = function() {
  const FEED_URL = '/feed.xml';
  const STORAGE_ETAG = 'feed-etag';
  const HIDDEN_KEY   = 'hidden';

  return {
    entries: [],
    // load saved closed items (or default to empty array)
    hidden: JSON.parse(localStorage.getItem(HIDDEN_KEY) || '[]'),
    loading: true,

    async init() {
      this.initTheme();
      // On first load, fetch full feed (ignore etag); subsequent loads will use etag
      await this.loadFeed(true);

      // every N minutes, check for updates (use etag for conditional requests)
      setInterval(() => this.loadFeed(), 5 * 60 * 1000);
    },

    /**
     * @param {boolean} ignoreEtag  If true, always fetch full feed without conditional header
     */
    async loadFeed(ignoreEtag = false) {
      this.loading = true;

      const prevEtag = localStorage.getItem(STORAGE_ETAG);
      const headers = {};
      // Only add If-None-Match header when not ignoring etag and we have an etag AND entries already loaded
      if (!ignoreEtag && prevEtag && this.entries.length > 0) {
        headers['If-None-Match'] = prevEtag;
      }

      try {
        const res = await fetch(FEED_URL, { method: 'GET', headers });

        // Handle 304 Not Modified: keep existing entries, no deletion
        if (res.status === 304) {
          return;
        }

        if (!res.ok) {
          if (res.status === 404) {
            this.errorMessage = 'Feed not found (404).';
          } else {
            this.errorMessage = `Feed request failed with status ${res.status}.`;
          }
          return;
        }

        // store new ETag for next time
        const newEtag = res.headers.get('ETag');
        if (newEtag) {
          localStorage.setItem(STORAGE_ETAG, newEtag);
        }

        // parse the updated feed
        const xml   = await res.text();
        const parser = new RSSParser();
        const feed   = await parser.parseString(xml);

        // Map items and strip HTML
        const mapped = feed.items.map(item => {
          const raw = item.content || item.contentSnippet || item.summary || item.description || '';
          const tmp = document.createElement('div');
          tmp.innerHTML = raw;

          return {
            title:       item.title,
            link:        item.link,
            pubDate:     this.formatDate(item.pubDate || item.isoDate || ''),
            description: (tmp.textContent || tmp.innerText || '').trim()
          };
        });

        // Filter out any hidden items so they stay hidden on reload
        this.entries = mapped.filter(entry => !this.hidden.includes(entry.link));
      } catch (err) {
        console.error('Failed to load feed:', err);
      } finally {
        this.loading = false;
      }
    },

    initTheme() {
      const html = document.documentElement;
      const toggle = document.getElementById('theme-toggle');
      const themeText = document.getElementById('theme-text');
      if (!toggle || !themeText) return;

      // Initialize theme
      const saved = localStorage.getItem('theme');
      const useDark = saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches);
      html.classList.add(useDark ? 'dark' : 'light');
      toggle.checked = useDark;
      themeText.textContent = useDark ? 'dark' : 'light';

      // Listen for toggle changes
      toggle.addEventListener('change', () => {
        const newTheme = toggle.checked ? 'dark' : 'light';
        html.classList.remove(toggle.checked ? 'light' : 'dark');
        html.classList.add(newTheme);
        localStorage.setItem('theme', newTheme);
        themeText.textContent = newTheme;
      });
    },

    formatDate(dateString) {
      const now = new Date();
      const date = new Date(dateString);
      const diffInSeconds = Math.floor((now - date) / 1000);
      const twoWeeks = 2 * 7 * 24 * 60 * 60;

      if (diffInSeconds > twoWeeks) {
        return date.toLocaleString('en-GB', {
          weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
          hour: '2-digit', minute: '2-digit'
        });
      }

      const minutes = Math.floor(diffInSeconds / 60);
      const hours   = Math.floor(minutes / 60);
      const days    = Math.floor(hours / 24);

      if (diffInSeconds < 60) {
        return 'Just now';
      } else if (minutes < 60) {
        return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
      } else if (hours < 24) {
        return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
      } else if (days < 7) {
        return `${days} day${days !== 1 ? 's' : ''} ago`;
      } else {
        const weeks = Math.floor(days / 7);
        return `${weeks} week${weeks !== 1 ? 's' : ''} ago`;
      }
    },

    animateClose(event, link) {
      // Prevent multiple hides for the same entry
      if (this.hidden.includes(link)) {
        return;
      }

      const itemEl = event.target.closest('.item');

      // Set the max-height to current full height to enable collapse animation
      const fullHeight = itemEl.scrollHeight + 'px';
      itemEl.style.maxHeight = fullHeight;

      // Trigger a reflow so transition kicks in
      void itemEl.offsetHeight;

      // Collapse the item
      itemEl.style.transition = 'max-height 0.25s ease';
      itemEl.style.maxHeight = '0';

      // After the collapse animation, trigger the slide-right transition
      setTimeout(() => {
        itemEl.classList.add('slide-right');

        itemEl.addEventListener('transitionend', (e) => {
          if (e.propertyName === 'transform') {
            this.hide(link);
          }
        }, { once: true });
      }, 250);
    },
    
    hide(link) {
      if (!this.hidden.includes(link)) {
        this.hidden.push(link);
        localStorage.setItem(HIDDEN_KEY, JSON.stringify(this.hidden));
      }
      // remove from entries so x-for tears it out of the DOM
      this.entries = this.entries.filter(entry => entry.link !== link);
    },

    scrollToTop() {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };
};
