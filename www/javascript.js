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

      // 2) Fetch & parse RSS
      try {
        const parser = new RSSParser();
        const xml = await fetch('https://news.loveopenly.net/feed.xml').then(res => res.text());
        const feed = await parser.parseString(xml);
        this.entries = feed.items.map(item => {
          const raw = item.content || item.contentSnippet || item.summary || item.description || '';
          const tmp = document.createElement('div'); tmp.innerHTML = raw;
          return {
            title: item.title,
            link: item.link,
            pubDate: item.pubDate || item.isoDate || 'Unknown',
            description: (tmp.textContent || tmp.innerText || '').trim()
          };
        });
      } catch (e) {
        console.error('RSS load error', e);
      } finally {
        this.loading = false;
      }
    },

    initTheme() {
      const html = document.documentElement;
      const toggle = document.getElementById('theme-toggle');
      if (!toggle) return;

      // Initialize theme
      const saved = localStorage.getItem('theme');
      if (saved === 'dark' || saved === 'light') {
        html.classList.add(saved);
        toggle.checked = (saved === 'dark');
      } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        html.classList.add('dark');
        toggle.checked = true;
      } else {
        html.classList.add('light');
      }

      // Listen for toggle
      toggle.addEventListener('change', () => {
        const newTheme = toggle.checked ? 'dark' : 'light';
        html.classList.remove(toggle.checked ? 'light' : 'dark');
        html.classList.add(newTheme);
        localStorage.setItem('theme', newTheme);
      });
    },

    animateClose(event, link) {
      const itemEl = event.target.closest('.item');
      const desc = itemEl.querySelector('.itemdescription');
      desc.classList.add('collapsed');

      setTimeout(() => {
        itemEl.classList.add('slide-right');
        itemEl.addEventListener('transitionend', () => {
          const all = Array.from(itemEl.parentElement.querySelectorAll('.item'));
          const idx = all.indexOf(itemEl);
          const next = all.slice(idx + 1);
          const delta = itemEl.offsetHeight + parseFloat(getComputedStyle(itemEl).marginBottom);
          next.forEach(el => {
            el.style.transition = 'transform 0.250s ease';
            el.style.transform = `translateY(-500-${delta}px)`;
            el.addEventListener('transitionend', () => {
              el.style.transition = '';
              el.style.transform = '';
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

