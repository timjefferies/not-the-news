import re
import bleach
from bleach.linkifier import Linker
from bleach.callbacks import nofollow, target_blank
from html import unescape
import feedparser
from feedgen.feed import FeedGenerator
from dateutil.parser import parse
from datetime import datetime, timezone
import argparse
import markdown

# ——— bleach whitelist ———
ALLOWED_TAGS       = ['p','br','ul','ol','li','strong','em','a','img','blockquote','code','pre']
ALLOWED_ATTRIBUTES = {'a':['href','title','rel','target'], 'img':['src','alt','title','width','height']}
ALLOWED_PROTOCOLS  = ['http','https']

# set up a linker once
LINKER = Linker(callbacks=[nofollow, target_blank])

def sanitize_html(html: str) -> str:
    # Strip any tags/attributes not in your whitelist.
    cleaned = bleach.clean(
        html or '',
        tags=ALLOWED_TAGS,
        attributes=ALLOWED_ATTRIBUTES,
        protocols=ALLOWED_PROTOCOLS,
        strip=True,
        strip_comments=True
    )
    # inject safe rel/target on all <a>
    return LINKER.linkify(cleaned)

def get_pub_date(entry):
    for key in ('published','updated'):
        if key in entry and isinstance(entry[key], str):
            return parse(entry[key]).strftime('%a, %d %b %Y %H:%M:%S +0000')
    for key in ('published_parsed','updated_parsed'):
        if key in entry:
            tt = entry[key]
            return datetime(*tt[:6], tzinfo=timezone.utc)\
                   .strftime('%a, %d %b %Y %H:%M:%S +0000')
    # final fallback
    return datetime.now(timezone.utc)\
           .strftime('%a, %d %b %Y %H:%M:%S +0000')

def strip_html_to_text(text):
    """Remove HTML tags, decode entities, convert HTML line breaks to newlines, and sanitize text to ASCII-safe."""
    if not text:
        return ""

    # Convert HTML <br>, <br/>, etc. to newlines
    text = re.sub(r'(?i)<br\s*/?>', '\n', text)

    # Decode HTML entities like &amp;, &lt;, etc.
    text = unescape(text)

    # Convert common numeric carriage return entities to newlines
    text = re.sub(r'&#13;|&#x0?D;', '\n', text, flags=re.IGNORECASE)

    # Remove remaining HTML tags
    text = re.sub(r'<[^>]+>', '', text)

    # Remove any leftover named or numeric entities
    text = re.sub(r'&[a-zA-Z0-9#]+;', '', text)

    # Keep only ASCII characters and apostrophes
    return ''.join(c for c in text if ord(c) < 128 or c == "'")

def parse_and_sanitize_entries(entries):
    """Clean feed entries and extract valid RSS fields."""
    cleaned = []
    for entry in entries:
        title = entry.get('title', 'No Title')
        link = entry.get('link', '')
        # prefer the full HTML body if available, otherwise fall back to summary
        raw_html    = entry.get('content', [{'value': entry.get('summary','')}])[0]['value']
        # —–– FIRST convert any Markdown bullets (or other MD) into real HTML
        html_with_lists = markdown.markdown(raw_html)
        # —–– THEN sanitize that HTML to only your allowed tags/attrs
        description     = sanitize_html(html_with_lists)
        summary = strip_html_to_text(raw_html)
        
        # Use the get_pub_date function to retrieve the correct pubDate
        pub_date = get_pub_date(entry)

        # Extract image URLs from raw HTML
        images = re.findall(r'<img[^>]+src=["\']([^"\']+)["\']', description)

        # Clean text fields
        title = strip_html_to_text(title)
        
        # Clean the unwanted fields like 'published', 'published_parsed', 'updated', 'updated_parsed'
        # Remove them explicitly
        entry_cleaned = {key: entry[key] for key in entry if key not in ['published', 'published_parsed', 'updated', 'updated_parsed']}

        entry_cleaned.update({
            'title': title,
            'description': description,   # sanitized HTML
            'summary':     summary,       # plain-text fallback
            'link': link,
            'pubDate': pub_date,
        })

        cleaned.append(entry_cleaned)
    return cleaned

def validate_rss_fields(entry):
    """Ensure only valid RSS fields are used."""
    valid_keys = {'title','link','description','summary','pubDate'}
    return {key: entry[key] for key in entry if key in valid_keys}

def clean_feed(input_file, output_file):
    """Read a merged feed, clean its entries, remove invalid tags, and write a new RSS-compliant feed."""
    feed = feedparser.parse(input_file)
    entries = feed.entries
    cleaned_entries = parse_and_sanitize_entries(entries)

    # Sort cleaned entries by date
    cleaned_entries.sort(key=lambda x: parse(x['pubDate']))
    
    # Filter out invalid fields
    cleaned_entries = [validate_rss_fields(entry) for entry in cleaned_entries]

    fg = FeedGenerator()
    fg.title(feed.feed.get('title', 'Cleaned Feed'))

    # ——— AUTHOR FALLBACK ———
    author_name = feed.feed.get('author', '').strip()
    if author_name:
        fg.author({'name': author_name})

    # ——— IMAGE FALLBACK ———
    # feed.feed.get('image') can be a dict with 'href', or a simple URL string
    img = feed.feed.get('image', {})
    if isinstance(img, dict):
        img_url = img.get('href') or img.get('url')
    else:
        img_url = img
    if img_url:
        fg.image(url=img_url, title=feed.feed.get('title',''), link=feed.feed.get('link',''))

    # Extract a real URL if the feed link contains extra text

    raw_link = feed.feed.get('link', '')
    if isinstance(raw_link, dict):
        raw_link = raw_link.get('href', '')

    if isinstance(raw_link, str):
        match = re.search(r'https?://\S+', raw_link)
        cleaned_link = match.group(0) if match else 'https://example.com/dummy-feed-link'
    else:
        cleaned_link = 'https://example.com/dummy-feed-link'

    fg.link(href=cleaned_link, rel='alternate')

    fg.description(feed.feed.get('description', 'Cleaned feed.'))
    fg.language(feed.feed.get('language', 'en'))
    fg.docs(feed.feed.get('docs', ''))
    fg.generator('python-feedgen-cleaner')

    for entry in cleaned_entries:
        fe = fg.add_entry()
        fe.title(entry['title'])
        fe.link(
            href=str(entry['link']),
            rel='alternate',
            type='text/html'
        )
        fe.pubDate(entry['pubDate'])
        # use the full sanitized HTML as the description
        fe.description(entry['description'], type='CDATA')

    cleaned_feed = fg.rss_str(pretty=True)
    with open(output_file, 'wb') as out:
        out.write(cleaned_feed)
    print(f"Cleaned feed saved to '{output_file}' with {len(cleaned_entries)} entries.")

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="Clean a merged RSS/Atom feed file.")
    parser.add_argument('--input', required=True, help="Path to the merged feed XML.")
    parser.add_argument('--output', required=True, help="Path to save the cleaned feed XML.")
    args = parser.parse_args()
    clean_feed(args.input, args.output)
