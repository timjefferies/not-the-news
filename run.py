#!/usr/bin/env python3
import os
import subprocess
import psutil
import time

# Define paths for feed directory and files
feed_dir = 'data/feed/'
merged_file = os.path.join(feed_dir, 'merged_feed.xml')
cleaned_file = os.path.join(feed_dir, 'cleaned_feed.xml')
final_feed_file = os.path.join(feed_dir, 'feed.xml')
feeds_path = 'data/config/feeds.txt'
keywords_path = 'data/config/filter_keywords.txt'

# Ensure the feed directory exists
if not os.path.exists(feed_dir):
    os.makedirs(feed_dir, exist_ok=True)  # Create directory if it doesn't exist
    print(f"Directory created: {feed_dir}")
else:
    print(f"Directory already exists: {feed_dir}")

# Function to check if a process is running
def is_process_running(process_name):
    for proc in psutil.process_iter(['name']):
        if proc.info['name'] and process_name in proc.info['name']:
            return True
    return False

# Wait if 'merged_feeds.py' is running
process_name = 'merged_feeds.py'
while is_process_running(process_name):
    print(f"{process_name} is currently running. Waiting...")
    time.sleep(5)  # Wait for 5 seconds before checking again

print(f"{process_name} is not running. Proceeding with execution.")

########################################################
# Run merge_feeds.py, passing the merged_file as a flag
subprocess.run(['python3', 'merge_feeds.py', '--feeds', feeds_path, '--output', merged_file], check=True)

# Run clean_feed.py, passing the merged_file as a flag
subprocess.run(['python3', 'clean_feed.py', '--input', merged_file, '--output', cleaned_file], check=True)

# Run filter_feed.py with the input, output, and keywords flags
subprocess.run(['python3', 'filter_feed.py', '--input', cleaned_file, '--output', final_feed_file, '--keywords', keywords_path], check=True)

# Replace 'twitter.com' with 'nitter.net'
subprocess.run(["sed", "-i", "s/x.com/xcancel.net/g", final_feed_file], check=True)

# Replace 'img src' with 'img loading="lazy" src'
subprocess.run(["sed", "-i", "s/img src/img loading=\"lazy\" src/g", final_feed_file], check=True)

# Insert '<br><br>' after every '<br>' tag
subprocess.run(["sed", "-i", "s/<br>/<br><br>/g", final_feed_file], check=True)

# Replace 'www.reddit' with 'old.reddit'
subprocess.run(["sed", "-i", "s/www.reddit/old.reddit/g", final_feed_file], check=True)
