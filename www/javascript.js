window.rssApp = function() {
  const FEED_URL      = '/feed.xml';
  const STORAGE_ETAG  = 'feed-etag';
  const HIDDEN_KEY    = 'hidden';

  return {
    entries:  [],
    hidden:   JSON.parse(localStorage.getItem(HIDDEN_KEY) || '[]'),
    loading:  true,
    errorMessage: null,

    async init() {
      this.initTheme();
      await this.loadFeed();
      setInterval(() => this.loadFeed(), 5 * 60 * 1000);
    },

    async loadFeed() {
      this.loading = true;
      this.errorMessage = null;

      const prevEtag = localStorage.getItem(STORAGE_ETAG);
      const headers  = {};

      // Only send If-None-Match if we've already populated entries
      if (prevEtag && this.entries.length > 0) {
        headers['If-None-Match'] = prevEtag;
      }

      try {
        const res = await fetch(FEED_URL, { method: 'GET', headers });

        // If nothing changed, bail out (keep existing this.entries)
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

        // 200 → parse, map, filter, assign
        const xml    = await res.text();
        const parser = new RSSParser();
        const feed   = await parser.parseString(xml);

        const mapped = feed.items.map(item => {
          const raw = item.content
                   || item.contentSnippet
                   || item.summary
                   || item.description
                   || '';
          const tmp = document.createElement('div');
          tmp.innerHTML = raw;

          return {
            title:       item.title,
            link:        item.link,
            pubDate:     this.formatDate(item.pubDate || item.isoDate || ''),
            description: (tmp.textContent || tmp.innerText || '').trim()
          };
        });

        this.entries = mapped.filter(e => !this.hidden.includes(e.link));

        // Save the fresh ETag
        const newEtag = res.headers.get('ETag');
        if (newEtag) {
          localStorage.setItem(STORAGE_ETAG, newEtag);
        }

      } catch (err) {
        console.error('Failed to load feed:', err);
        this.errorMessage = 'Error loading feed.';
      } finally {
        this.loading = false;
      }
    },

    initTheme() {
      const html = document.documentElement;
      const toggle = document.getElementById('theme-toggle');
      const themeText = document.getElementById('theme-text');
      if (!toggle || !themeText) return;

      const saved = localStorage.getItem('theme');
      const useDark = saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches);
      html.classList.add(useDark ? 'dark' : 'light');
      toggle.checked = useDark;
      themeText.textContent = useDark ? 'dark' : 'light';

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
      // If already hidden, bail
      if (this.hidden.includes(link)) return;

      const itemEl = event.target.closest('.item');

      // 1) Prepare for collapse: set its current height as max-height
      const fullH = itemEl.scrollHeight + 'px';
      itemEl.style.maxHeight = fullH;
      void itemEl.offsetHeight;    // force a reflow

      // 2) Slide right AND collapse height at the same time
      itemEl.style.transform = 'translateX(100vw)';
      itemEl.style.maxHeight = '0';

      // 3) When collapse ends, finally remove it from the list
      itemEl.addEventListener('transitionend', e => {
        if (e.propertyName === 'max-height') {
          this.hide(link);
        }
      }, { once: true });
    },

    hide(link) {
      if (!this.hidden.includes(link)) {
        this.hidden.push(link);
        localStorage.setItem(HIDDEN_KEY, JSON.stringify(this.hidden));
      }
      this.entries = this.entries.filter(entry => entry.link !== link);
    },

    scrollToTop() {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };
};
