import re
from html import unescape
import feedparser
from feedgen.feed import FeedGenerator
from dateutil.parser import parse
from datetime import datetime, timezone
import argparse

def clean_text(text):
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

def clean_feed_entries(entries):
    """Clean feed entries and extract valid RSS fields."""
    cleaned = []
    for entry in entries:
        title = entry.get('title', 'No Title')
        description = entry.get('summary', 'No Description')
        link = entry.get('link', '')
        published = entry.get('published', datetime.now(timezone.utc).strftime('%a, %d %b %Y %H:%M:%S +0000'))

        # Extract image URLs from raw HTML
        images = re.findall(r'<img[^>]+src=["\']([^"\']+)["\']', description)

        # Clean text fields
        title = clean_text(title)
        description = clean_text(description)

        cleaned.append({
            'title': title,
            'description': description,
            'link': link,
            'pubDate': published,
            'images': images
        })
    return cleaned

def validate_rss_fields(entry):
    """Ensure only valid RSS fields are used."""
    valid_keys = {'title', 'link', 'description', 'pubDate'}
    return {key: entry[key] for key in entry if key in valid_keys}

def clean_feed(input_file, output_file):
    """Read a merged feed, clean its entries, remove invalid tags, and write a new RSS-compliant feed."""
    feed = feedparser.parse(input_file)
    entries = feed.entries
    cleaned_entries = clean_feed_entries(entries)

    # Sort cleaned entries by date
    cleaned_entries.sort(key=lambda x: parse(x['pubDate']))
    
    # Filter out invalid fields
    cleaned_entries = [validate_rss_fields(entry) for entry in cleaned_entries]

    fg = FeedGenerator()
    fg.title(feed.feed.get('title', 'Cleaned Feed'))
    fg.link(href=feed.feed.get('link', ''), rel='alternate')
    fg.description(feed.feed.get('description', 'Cleaned feed.'))
    fg.language(feed.feed.get('language', 'en'))
    fg.docs(feed.feed.get('docs', ''))
    fg.generator('python-feedgen-cleaner')

    for entry in cleaned_entries:
        fe = fg.add_entry()
        fe.title(entry['title'])
        fe.link(href=entry['link'])
        fe.pubDate(entry['pubDate'])
        desc = entry['description'] or 'No description available'
        fe.description(desc)

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
