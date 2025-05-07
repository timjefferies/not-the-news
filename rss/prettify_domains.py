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
    else:
        rest = ''

    h2_block = f"<h2>{rest}</h2>\n" if rest else ''
    entry['description'] = h2_block + description

    # derive a clean source_url from the original link (reddit.com/r/<subreddit>)
    raw_link = entry.get('link', '').strip()
    m = re.search(r'(reddit\.com/r/[^/]+)', raw_link)
    source_url = m.group(1) if m else raw_link
    # wrap it as hidden metadata and append to the end of the description
    metadata_tag = f'<span class="source-url" style="display:none">{source_url}</span>'
    entry['description'] += metadata_tag
    return entry

def prettify_hackernews_entry(entry):
    """Strip trailing ' | Hacker News' from titles."""
    title = entry.get('title', '').strip()
    link = entry.get('link', '')
    suffix = ' | Hacker News'
    if title.endswith(suffix):
        entry['title'] = title[:-len(suffix)]
    return entry

def prettify_x_entry(entry):
    """Redirect x.com links to xcancel.com."""
    link = entry.get('link', '').strip()
    if 'x.com' in link:
        # Replace domain inline, preserving path
        entry['link'] = link.replace('x.com', 'xcancel.com')
    return entry

def prettify_wired_entry(entry):
    """Wrap wired.com links via removepaywalls.com proxy."""
    link = entry.get('link', '').strip()
    if 'www.wired.com' in link:
        # Insert removepaywalls.com before the original URL
        entry['link'] = link.replace(
            'www.wired.com',
            'removepaywalls.com/https://www.wired.com'
        )
    return entry

def prettify_images(entry):
    """Add lazy loading to images and wrap them in anchor tags."""
    description = entry.get('description', '')
    # Replace each <img ... src="URL" ...> with a clickable, lazy-loaded image
    def repl(match):
        attrs = match.group(1) or ''
        url = match.group(2)
        suffix = match.group(3) or ''
        img_tag = f'<img loading="lazy"{attrs}src="{url}"{suffix}>'
        return f'<a href="{url}">{img_tag}</a>'
    new_desc = re.sub(r'<img([^>]*?)src="([^"]+)"([^>]*?)>', repl, description)
    entry['description'] = new_desc
    return entry

# Dispatcher
def prettify_domains(entry):
    # Global post-processing: images
    entry = prettify_images(entry)

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
    if 'x.com' in domain:
        return prettify_x_entry(entry)
    if 'wired.com' in domain:
        return prettify_wired_entry(entry)
    # add more domains here:
    # if domain == 'twitter.com': return prettify_twitter_entry(entry)

    return entry

