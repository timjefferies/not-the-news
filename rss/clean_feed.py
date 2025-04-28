import argparse
from html import unescape
from datetime import datetime, timezone
from dateutil.parser import parse
import feedparser
from feedgen.feed import FeedGenerator
import bleach

# ===== Configuration =====
ALLOWED_TAGS = [
    'p', 'ul', 'li', 'strong', 'em', 'a', 'br', 'div'
]
ALLOWED_ATTRIBUTES = {
    'a': ['href', 'rel', 'target']
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
    """
    Sanitize HTML using bleach, preserving only allowed tags and attributes.
    """
    if not text:
        return ''
    # Decode HTML entities
    text = unescape(text)
    # Clean with bleach, stripping disallowed tags but keeping their content
    cleaned = bleach.clean(
        text,
        tags=ALLOWED_TAGS,
        attributes=ALLOWED_ATTRIBUTES,
        protocols=ALLOWED_PROTOCOLS,
        strip=True
    )
    return cleaned


def clean_feed_entries(entries):
    """Clean feed entries and extract valid RSS fields."""
    cleaned = []
    for entry in entries:
        title = entry.get('title', '')
        description = entry.get('summary', '')
        link = entry.get('link', '')
        pub_date = get_pub_date(entry)

        # Extract images (if still needed)
        images = []

        # Sanitize
        title = clean_text(title)
        description = clean_text(description)

        # Build cleaned entry
        entry_cleaned = {
            'title': title,
            'link': link,
            'description': description,
            'pubDate': pub_date,
            'images': images
        }
        cleaned.append(entry_cleaned)
    return cleaned


def validate_rss_fields(entry: dict) -> dict:
    """Ensure only valid RSS fields are used."""
    valid_keys = {'title', 'link', 'description', 'pubDate'}
    return {k: entry[k] for k in entry if k in valid_keys}


def clean_feed(input_file: str, output_file: str):
    """Read a merged feed, sanitize entries, and write a new RSS feed."""
    feed = feedparser.parse(input_file)
    entries = feed.entries

    cleaned_entries = clean_feed_entries(entries)
    # Sort by publication date
    cleaned_entries.sort(key=lambda x: parse(x['pubDate']))
    # Filter to valid keys
    cleaned_entries = [validate_rss_fields(e) for e in cleaned_entries]

    fg = FeedGenerator()
    fg.title(feed.feed.get('title', 'Cleaned Feed'))
    fg.link(href=feed.feed.get('link', ''), rel='alternate')
    fg.description(feed.feed.get('description', ''))
    fg.language(feed.feed.get('language', 'en'))
    fg.generator('python-feedgen-cleaner')

    for entry in cleaned_entries:
        fe = fg.add_entry()
        fe.title(entry['title'])
        fe.link(href=entry['link'])
        fe.pubDate(entry['pubDate'])
        # Emit the HTML inside a CDATA-wrapped <content:encoded> element
        # (so the downstream cleaner can pick up real <p>, <ul>, <li>, etc.)
        fe.content(raw_html, type='CDATA')


    rss_bytes = fg.rss_str(pretty=True)
    with open(output_file, 'wb') as f:
        f.write(rss_bytes)
    print(f"Cleaned feed saved to '{output_file}' with {len(cleaned_entries)} entries.")


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="Clean a merged RSS/Atom feed file using bleach.")
    parser.add_argument('--input', '-i', required=True, help="Path to the merged feed XML.")
    parser.add_argument('--output', '-o', required=True, help="Path to save the cleaned feed XML.")
    args = parser.parse_args()
    clean_feed(args.input, args.output)

