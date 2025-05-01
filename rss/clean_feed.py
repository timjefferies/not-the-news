import argparse
from html import unescape
from datetime import datetime, timezone
from dateutil.parser import parse
import feedparser
from feedgen.feed import FeedGenerator
import bleach
import re
from prettify_domains import prettify_domains

# ===== Configuration =====
ALLOWED_TAGS = [
    'p', 'ul', 'li', 'strong', 'em', 'a', 'br', 'div', 'img'
]
ALLOWED_ATTRIBUTES = {
    'a': ['href', 'rel', 'target'],
    'img': ['src', 'alt', 'title'],
}
ALLOWED_PROTOCOLS = ['http', 'https', 'mailto']

# ===== Utility Functions =====
def get_pub_date(entry):
    """Determine the most reliable pubDate."""
    if 'published' in entry:
        return entry['published']
    elif 'published_parsed' in entry:
        return datetime(*entry['published_parsed'][:6], tzinfo=timezone.utc)\
            .strftime('%a, %d %b %Y %H:%M:%S +0000')
    elif 'updated' in entry:
        return entry['updated']
    elif 'updated_parsed' in entry:
        return datetime(*entry['updated_parsed'][:6], tzinfo=timezone.utc)\
            .strftime('%a, %d %b %Y %H:%M:%S +0000')
    return datetime.now(timezone.utc).strftime('%a, %d %b %Y %H:%M:%S +0000')


def clean_text(text: str) -> str:
    """Sanitize HTML using bleach, preserving only allowed tags and attributes."""
    if not text:
        return ''
    cleaned = bleach.clean(
        text,
        tags=ALLOWED_TAGS,
        attributes=ALLOWED_ATTRIBUTES,
        protocols=ALLOWED_PROTOCOLS,
        strip=True
    )
    return unescape(cleaned)


def clean_feed_entries(entries):
    """Clean feed entries and extract valid RSS fields."""
    cleaned = []
    for entry in entries:
        if not entry.get('link'):
            continue
        title = entry.get('title', '')
        description = entry.get('description', '')
        link = entry.get('link', '')
        pub_date = get_pub_date(entry)

        title = clean_text(title)
        # ————— auto-paragraph if no <p> or <br> tags —————
        # look for any existing paragraph or line-break tags
        if not re.search(r'<p\b|<br\s*/?>', description):
            # 1) protect common abbreviations by replacing their dots with a placeholder
            abbreviations = [
                'Mr.', 'Mrs.', 'Ms.', 'Dr.', 'Prof.', 'Sr.', 'Jr.',
                'St.', 'vs.', 'etc.', 'e.g.', 'i.e.', 'U.S.', 'U.K.'
            ]
            placeholder = '[DOT]'
            for abbr in abbreviations:
                description = description.replace(abbr, abbr.replace('.', placeholder))

            # 2) split into sentences on ., ! or ? followed by whitespace
            sentences = re.split(r'(?<=[.!?])\s+', description.strip())

            # 3) restore the dots in the abbreviations
            sentences = [s.replace(placeholder, '.') for s in sentences]

            # 4) group every 5 sentences into one <p>…</p>
            paras = [' '.join(sentences[i:i+5]) for i in range(0, len(sentences), 5)]
            description = ''.join(f'<p>{p}</p>' for p in paras)
        
        description = clean_text(description)

        # remove duplicate image tags from description
        description = re.sub(r'<img[^>]+src=["\'](https?://[^"\']+)["\'][^>]*>', 
                    lambda m, seen=set(): (seen.add(m.group(1)) or m.group(0) if m.group(1) not in seen else ''),
                    description)
        # create an image tag
        image = re.search(r'<img[^>]+src=["\'](.*?)["\']', description, re.IGNORECASE)
        if image:
            img_url = image.group(1)  # Extract the image URL
            img_extension = img_url.split('.')[-1].lower()
            mime_type = 'image/jpeg'  # Default type
            if img_extension == 'png':
                mime_type = 'image/png'
            elif img_extension == 'gif':
                mime_type = 'image/gif'
            elif img_extension == 'jpg' or img_extension == 'jpeg':
                mime_type = 'image/jpeg'
            if img_url:
                image = f'<media:content url="{img_url}" type="{mime_type}" />'
        else:
            image = ''  # If no image found, leave the content empty or handle it accordingly
        # additional item modifications based on source domain
        entry = prettify_domains(entry)

        entry_cleaned = {
            'title': title,
            'content': image,
            'link': link,
            'description': description,
            'pubDate': pub_date,
        }
        cleaned.append(entry_cleaned)
    return cleaned


def validate_rss_fields(entry: dict) -> dict:
    valid_keys = {'title', 'link', 'description', 'pubDate'}
    return {k: entry[k] for k in entry if k in valid_keys}


def clean_feed(input_file: str, output_file: str):
    """Read a merged feed, sanitize entries, and write a new RSS feed."""
    feed = feedparser.parse(input_file)
    entries = feed.entries

    cleaned_entries = clean_feed_entries(entries)
    cleaned_entries.sort(key=lambda x: parse(x['pubDate']))
    cleaned_entries = [validate_rss_fields(e) for e in cleaned_entries]

    fg = FeedGenerator()
    fg.title(feed.feed.get('title', 'Cleaned Feed'))

    # ————— Normalize the feed’s “link” into a string —————
    raw_link = feed.feed.get('link', '')
    if isinstance(raw_link, dict):
        feed_link = raw_link.get('href', '')
    elif isinstance(raw_link, list):
        # pick the first alternate link (or fall back to its href)
        feed_link = next(
            (l.get('href', '') for l in raw_link
             if isinstance(l, dict) and l.get('rel') == 'alternate'),
            raw_link[0].get('href', '') if raw_link and isinstance(raw_link[0], dict) else ''
        )
    else:
        feed_link = raw_link  # already a string

    if not feed_link:
        # fallback default — you should set this to your site’s home URL
        feed_link = 'https://example.com/'

    fg.link(href=feed_link, rel='alternate')
    fg.id(feed_link)
    fg.description(feed.feed.get('description', ''))
    fg.language(feed.feed.get('language', 'en'))
    fg.generator('python-feedgen-cleaner')

    for entry in cleaned_entries:
        fe = fg.add_entry()
        # Every entry gets an <id> (required internally) and a proper <link>
        fe.id(entry['link'])
        fe.title(entry['title'])
        fe.link(href=entry['link'], rel='alternate')
        fe.pubDate(entry['pubDate'])
        # Use cleaned HTML description from bleach
        raw_html = entry['description']
        # Emit the cleaned HTML inside a CDATA-wrapped <content:encoded> element
        fe.content(raw_html, type='CDATA')

    rss_bytes = fg.rss_str(pretty=True)
    with open(output_file, 'wb') as f:
        f.write(rss_bytes)
    print(f"Cleaned feed saved to '{output_file}' with {len(cleaned_entries)} entries.")


if __name__ == '__main__':
    parser = argparse.ArgumentParser(
        description="Clean a merged RSS/Atom feed file using bleach."
    )
    parser.add_argument('--input', '-i', required=True,
                        help="Path to the merged feed XML.")
    parser.add_argument('--output', '-o', required=True,
                        help="Path to save the cleaned feed XML.")
    args = parser.parse_args()
    clean_feed(args.input, args.output)

