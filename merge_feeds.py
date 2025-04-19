import time
from urllib.parse import urlparse
import feedparser
import unicodedata
import re
from feedgen.feed import FeedGenerator
import os
from dateutil.parser import parse
from datetime import datetime
from html import unescape
import argparse

# Set up argument parser
parser = argparse.ArgumentParser(description="Set the output file path using a flag.")
parser.add_argument('--output', required=True, help="Path to save the output file")

# Parse arguments
args = parser.parse_args()

# Set output_file variable based on the flag
output_file = args.output

def extract_domain(url):
    """Extract the domain from a URL."""
    parsed_url = urlparse(url)
    domain = parsed_url.netloc
    return domain

def remove_non_ascii(text):
    """Remove non-ASCII characters from a string, excluding certain allowed ones."""
    return ''.join(c for c in text if ord(c) < 128 or c in ["'"])

def clean_description(description):
    """Remove HTML tags, decode entities, and sanitize descriptions."""
    # Remove HTML tags
    description = re.sub(r'<[^>]+>', '', description)
    # Decode HTML entities
    description = unescape(description)
    # Remove non-ASCII characters
    description = remove_non_ascii(description)
    return description

def validate_url(url):
    """Validate the structure of a URL."""
    return urlparse(url).scheme in ('http', 'https')

def merge_feeds(file_path):
    previous_domain = None
    total_entries = 0

    # Create a new feed using feedgen
    fg = FeedGenerator()
    fg.title('Merged Feed')
    fg.link(href='http://example.com', rel='alternate')
    fg.description('This is a merged feed.')
    fg.language('en')  # Optional: Specify the feed's language
    fg.docs('http://www.rssboard.org/rss-specification')
    fg.generator('python-feedgen')

    with open(file_path, 'r') as file:
        feed_urls = [line.strip() for line in file if not line.startswith('#')]

    all_entries = []  # List to store all the feed entries

    for url in feed_urls:
        # Skip empty lines
        if not url:
            continue

        # Check the domain in the URL
        current_domain = extract_domain(url)

        # Validate the URL
        if not current_domain:
            print(f"Skipping invalid URL: {url}\n")
            continue

        # Parse each feed
        try:
            feed = feedparser.parse(url)
        except Exception as e:
            print(f"Error parsing feed {url}: {e}")
            continue

        print(f"Importing: {url}")
        print(f"Total entries found in {url}: {len(feed.entries)}")
        if not feed.entries:
            print(f"Warning: Feed {url} contains no entries.")
            continue

        # Delay for duplicate domains to avoid overloading
        if current_domain == previous_domain:
            time.sleep(5)
        previous_domain = current_domain

        # Iterate over the entries in the feed
        for entry in feed.entries:
            entry_title = clean_description(entry.title) if 'title' in entry else 'No Title'
            entry_description = clean_description(entry.description) if 'description' in entry else 'No Description'
            entry_link = entry.link if 'link' in entry and validate_url(entry.link) else 'http://example.com'
            entry_published = entry.published if 'published' in entry else datetime.utcnow().strftime('%a, %d %b %Y %H:%M:%S +0000')

            # Extract and clean image links from the description
            image_links = re.findall(r'<img[^>]+src="([^">]+)"', entry_description)
            for image_link in image_links:
                entry_description = entry_description.replace(image_link, '')  # Remove image links from description

            # Add the entry to the list
            all_entries.append((entry_published, entry_title, entry_description, entry_link, image_links))
            total_entries += 1

    # Sort entries by published date
    all_entries.sort(key=lambda x: parse(x[0]))

    # Add sorted entries to the merged feed
    for entry_published, entry_title, entry_description, entry_link, image_links in all_entries:
        fe = fg.add_entry()
        fe.title(entry_title)
        fe.link(href=entry_link)
        fe.pubDate(entry_published)
        fe.description(entry_description or 'No description available')

        # Optional: Embed image links in description
        for image_link in image_links:
            fe.description(f"{entry_description}<br/><img src='{image_link}' alt='{entry_title}'>")

    # Generate the XML representation of the merged feed
    try:
        merged_feed = fg.rss_str(pretty=True)
    except ValueError as e:
        print(f"Error generating merged feed: {e}")
        return

    # Save the merged feed to a file
    with open(output_file, 'w', encoding='utf-8') as output:
        output.write(merged_feed.decode('utf-8'))  # Ensure XML is written as a UTF-8 string

    print(f"Merged feed saved to '{output_file}'.")
    print(f"Total entries: {total_entries}")

# Example usage
feeds_file = 'data/config/feeds.txt'  # Path to the file containing feed URLs
merge_feeds(feeds_file)
