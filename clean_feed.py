import re
from html import unescape
import feedparser
from feedgen.feed import FeedGenerator
from dateutil.parser import parse
from datetime import datetime, timezone
import argparse

from datetime import datetime, timezone

def get_pub_date(entry):
    """Determine the most reliable pubDate."""
    # Check if 'published' exists as a string and use it
    if 'published' in entry:
        return entry['published']
    
    # If 'published_parsed' exists, convert it to a datetime and format it
    elif 'published_parsed' in entry:
        # published_parsed is a time.struct_time, so we need to convert it to datetime
        return datetime(*entry['published_parsed'][:6], tzinfo=timezone.utc).strftime('%a, %d %b %Y %H:%M:%S +0000')
    
    # If 'updated' exists as a string, use it
    elif 'updated' in entry:
        return entry['updated']
    
    # If 'updated_parsed' exists, convert it to a datetime and format it
    elif 'updated_parsed' in entry:
        # updated_parsed is also a time.struct_time
        return datetime(*entry['updated_parsed'][:6], tzinfo=timezone.utc).strftime('%a, %d %b %Y %H:%M:%S +0000')
    
    # Fallback to the current time if no date is found
    return datetime.now(timezone.utc).strftime('%a, %d %b %Y %H:%M:%S +0000')

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
        
        # Use the get_pub_date function to retrieve the correct pubDate
        pub_date = get_pub_date(entry)

        # Extract image URLs from raw HTML
        images = re.findall(r'<img[^>]+src=["\']([^"\']+)["\']', description)

        # Clean text fields
        title = clean_text(title)
        description = clean_text(description)
        
        # Clean the unwanted fields like 'published', 'published_parsed', 'updated', 'updated_parsed'
        # Remove them explicitly
        entry_cleaned = {key: entry[key] for key in entry if key not in ['published', 'published_parsed', 'updated', 'updated_parsed']}

        entry_cleaned.update({
            'title': title,
            'description': description,
            'link': link,
            'pubDate': pub_date,
            'images': images
        })

        cleaned.append(entry_cleaned)
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
    fg.link(href=str(feed.feed.get('link', '')), rel='alternate')
    fg.description(feed.feed.get('description', 'Cleaned feed.'))
    fg.language(feed.feed.get('language', 'en'))
    fg.docs(feed.feed.get('docs', ''))
    fg.generator('python-feedgen-cleaner')

    for entry in cleaned_entries:
        fe = fg.add_entry()
        fe.title(entry['title'])
        fe.link(href=str(entry['link']))
        fe.pubDate(get_pub_date(entry))
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
