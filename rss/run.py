#!/usr/bin/env python3

import os
import sys
import time
import argparse
import subprocess
import shutil

# --- Paths
feed_dir         = '../data/feed/'
merged_file      = os.path.join(feed_dir, 'merged_feed.xml')
filtered_file    = os.path.join(feed_dir, 'filtered_feed.xml')
final_feed_file  = os.path.join(feed_dir, 'feed.xml')
feeds_path       = '../data/config/feeds.txt'
keywords_path    = '../data/config/filter_keywords.txt'

# --- Ensure feed directory exists ---
if not os.path.exists(feed_dir):
    os.makedirs(feed_dir, exist_ok=True)
    print(f"Directory created: {feed_dir}")
else:
    print(f"Directory already exists: {feed_dir}")

def generate_feed():
    """Run the original pipeline via CLI scripts and sed replacements."""
    # 1) Merge
    subprocess.run([
        'python3', 'merge_feeds.py',
        '--feeds',   feeds_path,
        '--output',  merged_file
    ], check=True)

    # 2) Filter
    subprocess.run([
        'python3', 'filter_feed.py',
        '--input',   merged_file,
        '--output',  filtered_file,
        '--keywords', keywords_path
    ], check=True)

    # 3) Clean
    subprocess.run([
        'python3', 'clean_feed.py',
        '--input',  filtered_file,
        '--output', final_feed_file
    ], check=True)

    # 4) Post‐processing (same sed calls)
    subprocess.run(
        ['sed','-i','s/x.com/xcancel.net/g', final_feed_file],
        check=True
    )
    subprocess.run(
        ['sed','-i','s/img src/img loading="lazy" src/g', final_feed_file],
        check=True
    )
    subprocess.run(
        ['sed','-i','s/www.reddit/old.reddit/g', final_feed_file],
        check=True
    )

    print("Feed updated successfully")

def main():
    parser = argparse.ArgumentParser(
        description="Not-the-News feed generator"
    )
    parser.add_argument(
        '--daemon',
        action='store_true',
        help='Run continuously in daemon mode'
    )
    parser.add_argument(
        '--interval',
        type=int,
        default=300,
        help='Seconds between runs in daemon mode'
    )
    args = parser.parse_args()

    if args.daemon:
        print(f"Starting in daemon mode (interval={args.interval}s)")
        try:
            while True:
                generate_feed()
                time.sleep(args.interval)
        except KeyboardInterrupt:
            print("Daemon shutdown requested; exiting.")
            sys.exit(0)
    else:
        generate_feed()

if __name__ == "__main__":
    main()
