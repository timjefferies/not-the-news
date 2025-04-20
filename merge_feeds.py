import time
from urllib.parse import urlparse
import feedparser
from feedgen.feed import FeedGenerator
from datetime import datetime
import argparse
import requests
import pprint


def extract_domain(url):
    """Extract the domain from a URL."""
    parsed_url = urlparse(url)
    return parsed_url.netloc


def validate_url(url):
    """Validate the structure of a URL."""
    parsed = urlparse(url)
    return parsed.scheme in ('http', 'https') and bool(parsed.netloc)


def merge_feeds(feeds_file, output_file):
    """Fetch multiple RSS/Atom feeds, merge entries, and write to an output file."""
    previous_domain = None
    total_entries = 0

    fg = FeedGenerator()
    fg.title('Merged Feed')
    fg.link(href='http://example.com', rel='alternate')
    fg.description('This is a merged feed.')
    fg.language('en')
    fg.docs('http://www.rssboard.org/rss-specification')
    fg.generator('python-feedgen')

    # Read the list of feed URLs
    with open(feeds_file, 'r') as f:
        feed_urls = [line.strip() for line in f if line.strip() and not line.startswith('#')]

    all_entries = []
    headers = {'User-Agent': 'Mozilla/5.0'}  # Add a custom User-Agent
    for url in feed_urls:
        if not validate_url(url):
            print(f"Skipping invalid URL: {url}")
            continue

        current_domain = extract_domain(url)
        if current_domain == previous_domain:
            time.sleep(5)
        previous_domain = current_domain

        try:
            # Use requests to fetch the feed with a custom User-Agent
            response = requests.get(url, headers=headers)
            response.raise_for_status()  # Raise HTTP errors
            feed = feedparser.parse(response.content)
        except Exception as e:
            print(f"Error fetching or parsing feed {url}: {e}")
            continue

        print(f"Importing: {url} ({len(feed.entries)} entries)")
        if len(feed.entries) == 0:
            print(f"Debug: No entries found in feed {url}. Feed content: {pprint.pformat(feed)}")
            continue

        for entry in feed.entries:
            all_entries.append(entry)
            total_entries += 1

    # Sort by published date (use current time if missing)
    def get_date(e):
        try:
            return e.published_parsed or datetime.utcnow().timetuple()
        except Exception:
            return datetime.utcnow().timetuple()

    all_entries.sort(key=get_date)

    # Build the merged feed without cleaning
    for entry in all_entries:
        fe = fg.add_entry()
        fe.title(entry.get('title', 'No Title'))
        fe.link(href=entry.get('link', ''))
        fe.pubDate(entry.get('published', datetime.utcnow().strftime('%a, %d %b %Y %H:%M:%S +0000')))
        fe.description(entry.get('summary', ''))

    merged_feed = fg.rss_str(pretty=True)
    with open(output_file, 'wb') as out:
        out.write(merged_feed)

    print(f"Merged feed saved to '{output_file}' with {total_entries} entries.")


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="Merge multiple RSS/Atom feeds into one.")
    parser.add_argument('--feeds', required=True, help="Path to the text file listing feed URLs.")
    parser.add_argument('--output', required=True, help="Path to save the merged feed XML.")
    args = parser.parse_args()
    merge_feeds(args.feeds, args.output)
