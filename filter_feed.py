import feedparser
import xml.etree.ElementTree as ET

import argparse

# Set up argument parser
parser = argparse.ArgumentParser(description="Filter an RSS feed based on keywords.")
parser.add_argument('--input', required=True, help="Path to the input RSS file")
parser.add_argument('--output', required=True, help="Path to save the filtered RSS file")
parser.add_argument('--keywords', required=True, help="Path to the keywords file")

# Parse arguments
args = parser.parse_args()

# Assign parsed arguments to variables
input_rss_file = args.input
output_rss_file = args.output
keywords_file = args.keywords

# Print the parsed arguments (optional, for testing)
print(f"Input RSS file: {input_rss_file}")
print(f"Output RSS file: {output_rss_file}")
print(f"Keywords file: {keywords_file}")


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

filter_rss_entries(input_rss_file, output_rss_file, keywords_file)

