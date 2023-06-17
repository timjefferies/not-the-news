import feedparser
import xml.etree.ElementTree as ET

def load_filter_keywords(file_path):
    with open(file_path, 'r') as f:
        keywords = [line.strip().lower() for line in f if line.strip()]
    return keywords

def filter_rss_entries(input_file, output_file, keywords_file):
    # Load filter keywords
    keywords = load_filter_keywords(keywords_file)

    # Parse the RSS feed
    feed = feedparser.parse(input_file)

    filtered_entries = []
    for entry in feed.entries:
        try:
            entry_title_lower = entry.title.lower()
        except AttributeError:
            print(f"Skipped entry without a 'title':\n {entry}\n")
            continue

        if not any(keyword in entry_title_lower for keyword in keywords):
            filtered_entries.append(entry)

    # Create a new XML tree for the filtered feed
    filtered_root = ET.Element("rss", attrib={"version": feed.version})
    channel_elem = ET.SubElement(filtered_root, "channel")

    for key, value in feed.feed.items():
        ET.SubElement(channel_elem, key).text = str(value)

    for entry in filtered_entries:
        entry_elem = ET.SubElement(channel_elem, 'item')
        for key, value in entry.items():
            ET.SubElement(entry_elem, key).text = str(value)

    filtered_tree = ET.ElementTree(filtered_root)

    # Save the filtered feed to a new RSS file
    with open(output_file, 'wb') as f:
        filtered_tree.write(f, encoding='utf-8', xml_declaration=True)

# Example usage
input_rss_file = "/tmp/merged_feed.xml"
output_rss_file = "/tmp/filtered_feed.xml"
keywords_file = "www/config/filter_keywords.txt"

filter_rss_entries(input_rss_file, output_rss_file, keywords_file)

