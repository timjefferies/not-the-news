// javascript.js
// Attach to global so Alpine can see it
window.rssApp = function() {
  return {
    entries: [],
    hidden: [],
    loading: true,

    async init() {
      this.initTheme();

      // 1) Restore hidden links from localStorage
      const stored = JSON.parse(localStorage.getItem('hidden') || '[]');
      this.hidden = Array.isArray(stored) ? stored : [];

      // 2) Fetch & parse RSS
      try {
        const parser = new RSSParser();
        const response = await fetch('https://news.loveopenly.net/feed.xml');
        const xml = await response.text();
        const feed = await parser.parseString(xml);

        this.entries = feed.items.map(item => {
          const raw = item.content || item.contentSnippet || item.summary || item.description || '';
          const tmp = document.createElement('div');
          tmp.innerHTML = raw;

          return {
            title: item.title,
            link: item.link,
            pubDate: this.formatDate(item.pubDate || item.isoDate || ''),
            description: (tmp.textContent || tmp.innerText || '').trim()
          };
        });
      } catch (error) {
        console.error('Error fetching or parsing the feed:', error);
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
      const itemEl = event.target.closest('.item');
      const desc   = itemEl.querySelector('.itemdescription');
      desc.classList.add('collapsed');

      // wait for collapse animation (~250ms)
      setTimeout(() => {
        itemEl.classList.add('slide-right');

        // after slide transform ends, hide the item
        itemEl.addEventListener('transitionend', e => {
          if (e.propertyName === 'transform') {
            this.hide(link);
          }
        }, { once: true });
      }, 250);
    },

    hide(link) {
      if (!this.hidden.includes(link)) {
        this.hidden.push(link);
        localStorage.setItem('hidden', JSON.stringify(this.hidden));
      }
    },

    scrollToTop() {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };
};

