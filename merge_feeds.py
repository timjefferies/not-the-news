import time
from urllib.parse import urlparse
import feedparser
import unicodedata
import re
from feedgen.feed import FeedGenerator

def extract_domain(url):
    parsed_url = urlparse(url)
    domain = parsed_url.netloc
    return domain

def remove_non_ascii(text):
    # Remove non-ASCII characters excluding specific characters
    return ''.join(c for c in text if ord(c) < 128 or c in ["'"])

def merge_feeds(file_path):
    previous_domain = None
    total_entries = 0

    # Create a new feed using feedgen
    fg = FeedGenerator()
    fg.title('Merged Feed')
    fg.link(href='http://example.com', rel='alternate')
    fg.description('This is a merged feed.')

    with open(file_path, 'r') as file:
        feed_urls = [line.strip() for line in file if not line.startswith('#')]

    all_entries = []  # List to store all the feed entries

    for url in feed_urls:
        # skip empty lines
        if not url:
            continue
        
        # check the domain in the url
        current_domain = extract_domain(url)

        # Check if the URL contains a domain
        if not current_domain:
            print(f" Skipping invalid URL: {url}\n")
            continue

        # Parse each feed
        feed = feedparser.parse(url)
        print(f"importing: {url}")

        # Check if the domain is the same as the previous feed
        if current_domain == previous_domain:
            time.sleep(5)  # Delay for 5 seconds

        # Update the previous_domain variable
        previous_domain = current_domain

        # ############
        # process feed
        ##############

        # Iterate over the entries in the feed
        for entry in feed.entries:
            # Remove non-ASCII characters from the title
            entry_title = remove_non_ascii(entry.title)

            # Remove non-ASCII characters from the description
            entry_description = remove_non_ascii(entry.description)

            # Extract image links from description
            image_links = re.findall(r'<img[^>]+src="([^">]+)"', entry_description)
            for image_link in image_links:
                # Remove the image link from the description
                entry_description = entry_description.replace(image_link, '')

            # Get the published date of the entry
            entry_published = entry.published

            # Add the entry to the list
            all_entries.append((entry_published, entry_title, entry_description, entry.link, image_links))
        
            # Increment the total number of entries
            total_entries += 1

            # Print the count on the same line
            #print(f"\r\tProcessing entry {total_entries}/{len(all_entries)}", end='', flush=True)

    # Sort the entries based on the published date
    all_entries.sort(key=lambda x: x[0])

    # Iterate over the sorted entries and add them to the merged feed
    for entry_published, entry_title, entry_description, entry_link, image_links in all_entries:
        fe = fg.add_entry()
        fe.title(entry_title)
        fe.link(href=entry_link)
        fe.published(entry_published)

        # Add description if available
        if entry_description:
            fe.description(entry_description)
        else:
            fe.description('No description available')  # Default value if description is not set

        # Add image links as separate entries
        for image_link in image_links:
            fe_image = fg.add_entry()
            fe_image.title('Image')
            fe_image.link(href=image_link)
            fe_image.published(entry_published)

    # Generate the XML representation of the merged feed
    try:
        merged_feed = fg.rss_str(pretty=True)
    except ValueError as e:
        print(f"Error generating merged feed: {e}")
        return

    # Save the merged feed to a file
    output_file = '/tmp/merged_feed.xml'
    with open(output_file, 'wb') as output:
        output.write(merged_feed)

    print(f"Merged feed saved to '{output_file}'.")
    print(f"Total entries: {total_entries}")

# Example usage
feeds_file = 'www/config/feeds.txt'  # Path to the file containing feed URLs
merge_feeds(feeds_file)

