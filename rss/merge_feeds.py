import time
from urllib.parse import urlparse
import feedparser
from feedgen.feed import FeedGenerator
from datetime import datetime, timezone
from dateutil.parser import parse
import argparse
import requests
import pprint


def extract_domain(url, cache={}):
    """Extract the domain from a URL with basic caching."""
    if url in cache:
        return cache[url]
    parsed_url = urlparse(url)
    domain = parsed_url.netloc
    cache[url] = domain
    return domain


def validate_url(url):
    """Validate the structure of a URL."""
    parsed = urlparse(url)
    return parsed.scheme in ('http', 'https') and bool(parsed.netloc)


def merge_feeds(feeds_file, output_file):
    """Fetch multiple RSS/Atom feeds, merge entries, and write to an output file."""
    total_entries = 0
    seen_entries = set()  # Store keys we've seen (link or fallback ID)

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

    # Sort feed URLs by their domain
    domain_cache = {}
    feed_urls.sort(key=lambda url: extract_domain(url, domain_cache))

    headers = {'User-Agent': 'not-the-news/1.0 (by /u/azureuser)'}
    domain_requests = {}
    for url in feed_urls:
        if not validate_url(url):
            print(f"Skipping invalid URL: {url}")
            continue

        current_domain = extract_domain(url, domain_cache)
        domain_requests[current_domain] = domain_requests.get(current_domain, 0) + 1
        if domain_requests[current_domain] > 5:
            print(f"Rate-limiting domain: {current_domain}. Waiting for 10 seconds...", end='\r', flush=True)
            time.sleep(10)
            domain_requests[current_domain] = 0  # Reset counter for domain

        while True:  # Retry loop
            try:
                # Use requests to fetch the feed with a custom User-Agent
                response = requests.get(url, headers=headers)
                time.sleep(1)
                if response.status_code == 429:  # Too Many Requests
                    print(f"429 Too Many Requests for {url}. Retrying in 30 seconds...")
                    time.sleep(30)  # Wait before retrying
                    continue
                response.raise_for_status()  # Raise HTTP errors other than 429
                feed = feedparser.parse(response.content)
                break  # Exit loop if successful
            except requests.exceptions.RequestException as e:
                # this will print an error *and* force a newline
                print(f"Error fetching feed {url}: {e}")
                break  # Exit loop for other errors

        print(f"Importing: {url} ({len(feed.entries)} entries)", end='\r', flush=True)
        if len(feed.entries) == 0:
            print(f"Debug: No entries found in feed {url}. Feed content: {pprint.pformat(feed)}")
            continue

        for entry in feed.entries:
            entry_link = entry.get('link')
            entry_title = entry.get('title', '')
            entry_published = entry.get('published', '')
            
            # Use link if available, otherwise fall back to title+published
            entry_key = entry_link if entry_link else f"{entry_title}_{entry_published}"
            if entry_key in seen_entries:
                continue  # Skip duplicates
            seen_entries.add(entry_key)

            fe = fg.add_entry()
            fe.title(entry_title or 'No Title')
            if entry_link:
                fe.link(
                    href=entry_link,
                    rel='alternate',
                    type='text/html'
                )            
            
            # pick published or updated timestamp string
            date_str = entry.get('published') or entry.get('updated')
            if date_str:
                # parse into a datetime (handles RFC-822, ISO8601, etc.)
                pub_dt = parse(date_str)              # :contentReference[oaicite:1]{index=1}
            else:
                # fallback to a true datetime object
                pub_dt = datetime.now(timezone.utc)

            # feedgen.pubDate accepts a datetime, and will format it correctly
            fe.pubDate(pub_dt)

            fe.description(entry.get('summary', ''))
            total_entries += 1

    merged_feed = fg.rss_str(pretty=True)
    with open(output_file, 'wb') as out:
        out.write(merged_feed)

    print()
    print(f"Merged feed saved to '{output_file}' with {total_entries} entries.")


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="Merge multiple RSS/Atom feeds into one.")
    parser.add_argument('--feeds', required=True, help="Path to the text file listing feed URLs.")
    parser.add_argument('--output', required=True, help="Path to save the merged feed XML.")
    args = parser.parse_args()
    merge_feeds(args.feeds, args.output)
