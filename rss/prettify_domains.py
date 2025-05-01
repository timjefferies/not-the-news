# Certain websites don't present the rss feed entriies in the best way.
# This module checks if an rss item is from a certain domain and applies cosmetic tweaks to the entry.

import re
from urllib.parse import urlparse

def prettify_reddit_entry(entry):
    """Handle reddit.com multi-sentence titles."""
    title = entry.get('title', '').strip()
    description = entry.get('description', '').strip()
    parts = re.split(r'(?<=[.!?])\s+', title, maxsplit=1)
    if len(parts) == 2:
        first_sentence, rest = parts
        entry['title'] = first_sentence
        entry['description'] = f"<h2>{rest}</h2>\n" + description
    # strip everything before “reddit.com/r/<subreddit>” and after it
    entry['link'] = re.sub(
    r'^https?://(?:old\.|www\.)?reddit\.com/r/([^/]+)/.*$',
    r'https://reddit.com/r/\1/',
    entry['link'])

    return entry

def prettify_hackernews_entry(entry):
    """Strip trailing ' | Hacker News' from titles."""
    title = entry.get('title', '').strip()
    link = entry.get('link', '')
    suffix = ' | Hacker News'
    if title.endswith(suffix):
        entry['title'] = title[:-len(suffix)]
    return entry

# Dispatcher
def prettify_domains(entry):
    """
    Inspect entry['link'], figure out the domain,
    and call the corresponding prettify function.
    """
    link = entry.get('link', '')
    hostname = ''
    try:
        hostname = urlparse(link).hostname or ''
    except Exception:
        pass

    # Normalize to just the main domain
    domain = hostname.lower().removeprefix('www.')

    if 'reddit.com' in domain:
        return prettify_reddit_entry(entry)
    if 'news.ycombinator.com' in domain:
        return prettify_hackernews_entry(entry)
    # add more domains here:
    # if domain == 'twitter.com': return prettify_twitter_entry(entry)

    # fallback: no changes
    return entry

