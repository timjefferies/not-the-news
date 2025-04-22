// javascript.js
// Attach to global so Alpine can see it
window.rssApp = function() {
  return {
    entries: [],
    hiddenSet: new Set(),
    loading: true,

    async init() {
      this.initTheme();

      // 1) Restore hidden links
      const stored = JSON.parse(localStorage.getItem('hidden') || '[]');
      this.hiddenSet = new Set(stored);

      // Helper: format dates to "X ago" or full date if older than 2 weeks
      const formatDate = (dateString) => {
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
      };

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
            pubDate: formatDate(item.pubDate || item.isoDate || ''),
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

    animateClose(event, link) {
      const itemEl = event.target.closest('.item');
      const desc   = itemEl.querySelector('.itemdescription');
      desc.classList.add('collapsed');

      setTimeout(() => {
        itemEl.classList.add('slide-right');
        itemEl.addEventListener('transitionend', () => {
          const siblings = Array.from(itemEl.parentElement.querySelectorAll('.item'));
          const index    = siblings.indexOf(itemEl);
          const nextEls  = siblings.slice(index + 1);
          const delta    = itemEl.offsetHeight + parseFloat(getComputedStyle(itemEl).marginBottom);

          nextEls.forEach(el => {
            el.style.transition = 'transform 0.25s ease';
            el.style.transform  = `translateY(-${delta}px)`;
            el.addEventListener('transitionend', () => {
              el.style.transition = '';
              el.style.transform  = '';
            }, { once: true });
          });

          this.hide(link);
        }, { once: true });
      }, 250);
    },

    hide(link) {
      this.hiddenSet.add(link);
      localStorage.setItem('hidden', JSON.stringify([...this.hiddenSet]));
    },

    scrollToTop() {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };
};

