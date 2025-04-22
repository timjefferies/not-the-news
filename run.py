#!/usr/bin/env python3
import os
import subprocess
import time

# Define paths for feed directory and files
feed_dir = 'data/feed/'
merged_file = os.path.join(feed_dir, 'merged_feed.xml')
filtered_file = os.path.join(feed_dir, 'filtered_feed.xml')
final_feed_file = os.path.join(feed_dir, 'feed.xml')
feeds_path = 'data/config/feeds.txt'
keywords_path = 'data/config/filter_keywords.txt'

# Ensure the feed directory exists
if not os.path.exists(feed_dir):
    os.makedirs(feed_dir, exist_ok=True)  # Create directory if it doesn't exist
    print(f"Directory created: {feed_dir}")
else:
    print(f"Directory already exists: {feed_dir}")


########################################################
# Run merge_feeds.py, passing the merged_file as a flag
subprocess.run(['python3', 'merge_feeds.py', '--feeds', feeds_path, '--output', merged_file], check=True)

# Run filter_feed.py with the input, output, and keywords flags
subprocess.run(['python3', 'filter_feed.py', '--input', merged_file, '--output', filtered_file, '--keywords', keywords_path], check=True)

# Run clean_feed.py, passing the merged_file as a flag
subprocess.run(['python3', 'clean_feed.py', '--input', filtered_file, '--output', final_feed_file], check=True)

# Replace 'x.com' with 'xcancel.com'
subprocess.run(["sed", "-i", "s/x.com/xcancel.net/g", final_feed_file], check=True)

# Replace 'img src' with 'img loading="lazy" src'
subprocess.run(["sed", "-i", "s/img src/img loading=\"lazy\" src/g", final_feed_file], check=True)

# Replace 'www.reddit' with 'old.reddit'
subprocess.run(["sed", "-i", "s/www.reddit/old.reddit/g", final_feed_file], check=True)
