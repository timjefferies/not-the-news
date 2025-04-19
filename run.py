#!/usr/bin/env python3
import os
import pwd
import grp
import sys
import subprocess

# Define paths for feed directory and files
feed_dir = 'data/feed/'
merged_file = os.path.join(feed_dir, 'merged_feed.xml')
feed_file = os.path.join(feed_dir, 'feed.xml')
keywords_path = 'data/config/filter_keywords.txt'

# Ensure the feed directory exists
if not os.path.exists(feed_dir):
    os.makedirs(feed_dir, exist_ok=True)  # Create directory if it doesn't exist
    print(f"Directory created: {feed_dir}")
else:
    print(f"Directory already exists: {feed_dir}")


########################################################
# Run merge_feeds.py, passing the merged_file as a flag
subprocess.run(['python3', 'merge_feeds.py', '--output', merged_file], check=True)

# Run filter_feed.py with the input, output, and keywords flags
subprocess.run(['python3', 'filter_feed.py', '--input', merged_file, '--output', feed_file, '--keywords', keywords_path], check=True)

# Replace 'twitter.com' with 'nitter.net'
subprocess.run(["sed", "-i", "s/twitter.com/nitter.net/g", feed_file], check=True)

# Replace 'img src' with 'img loading="lazy" src'
subprocess.run(["sed", "-i", "s/img src/img loading=\"lazy\" src/g", feed_file], check=True)

# Insert '<br><br>' after every '<br>' tag
subprocess.run(["sed", "-i", "s/<br>/<br><br>/g", feed_file], check=True)

# Replace 'www.reddit' with 'old.reddit'
subprocess.run(["sed", "-i", "s/www.reddit/old.reddit/g", feed_file], check=True)



# Run make_html.py
#subprocess.run(['python3', 'make_html.py'])

# Minify www/data/final-rss.html (implement the minification logic here)
