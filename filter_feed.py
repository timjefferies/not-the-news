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

# Print the parsed arguments (optional, for testing purposes)
print(f"Input RSS file: {input_rss_file}")
print(f"Output RSS file: {output_rss_file}")
print(f"Keywords file: {keywords_file}")

def load_filter_keywords(file_path):
    """Load keywords from a file, stripping whitespace and converting to lowercase."""
    try:
        with open(file_path, 'r') as f:
            keywords = [line.strip().lower() for line in f if line.strip()]
        print(f"Loaded {len(keywords)} keywords from {file_path}.")
        return keywords
    except FileNotFoundError:
        print(f"Error: Keywords file {file_path} not found.")
        exit(1)

def filter_rss_entries(input_file, output_file, keywords_file):
    """Filter RSS feed entries based on keywords."""
    # Load filter keywords
    keywords = load_filter_keywords(keywords_file)

    # Parse the RSS feed
    print(f"Parsing RSS feed from {input_file}...")
    feed = feedparser.parse(input_file)
    if not feed.entries:
        print(f"Warning: No entries found in the RSS feed.")
        exit(1)

    # Filter entries based on keywords
    filtered_entries = []
    for entry in feed.entries:
        # Combine all fields of the entry into a single text for keyword matching
        entry_text = " ".join([str(value).lower() for key, value in entry.items() if value])
        
        # Exclude entries with keywords
        if not any(keyword in entry_text for keyword in keywords):
            filtered_entries.append(entry)
        else:
            print(f"Excluding entry with keyword match: {entry.title if hasattr(entry, 'title') else 'No title'}")

    print(f"Filtered {len(filtered_entries)} entries out of {len(feed.entries)}.")

    # Create a new XML tree for the filtered feed
    filtered_root = ET.Element("rss", attrib={"version": "2.0"})
    channel_elem = ET.SubElement(filtered_root, "channel")

    # Add metadata from the original feed
    for key, value in feed.feed.items():
        ET.SubElement(channel_elem, key).text = str(value)

    # Add filtered entries to the feed
    for entry in filtered_entries:
        entry_elem = ET.SubElement(channel_elem, 'item')
        for key, value in entry.items():
            ET.SubElement(entry_elem, key).text = str(value)

    # Create the XML tree for the filtered feed
    filtered_tree = ET.ElementTree(filtered_root)

    # Save the filtered feed to a new RSS file
    try:
        with open(output_file, 'wb') as f:
            filtered_tree.write(f, encoding='utf-8', xml_declaration=True)
        print(f"Filtered RSS feed saved to {output_file}.")
    except Exception as e:
        print(f"Error saving filtered feed: {e}")
        exit(1)

# Run the filtering process
filter_rss_entries(input_rss_file, output_rss_file, keywords_file)
