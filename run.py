import subprocess
import os

# Run merge_feeds.py
subprocess.run(['python3', 'merge_feeds.py'])

# Run filter_feed.py
subprocess.run(['python3', 'filter_feed.py'])

# Replace 'twitter.com' with 'nitter.net' in /tmp/filtered_feed.xml
subprocess.run(["sed", "-i", "s/twitter.com/nitter.net/g", "/tmp/filtered_feed.xml"])

# Replace 'img src' with 'img loading="lazy" src' in /tmp/filtered_feed.xml
subprocess.run(["sed", "-i", "s/img src/img loading=\"lazy\" src/g", "/tmp/filtered_feed.xml"])

# Insert '<br><br>' after every '<br>' tag in /tmp/filtered_feed.xml
subprocess.run(["sed", "-i", "s/<br>/<br><br>/g", "/tmp/filtered_feed.xml"])

# Replace 'www.reddit' with 'old.reddit' in /tmp/filtered_feed.xml
subprocess.run(["sed", "-i", "s/www.reddit/old.reddit/g", "/tmp/filtered_feed.xml"])

# Create directory www/data if it doesn't exist
os.makedirs("www/data", exist_ok=True)

# Run make_html.py
subprocess.run(['python3', 'make_html.py'])

# Minify www/data/final-rss.html (implement the minification logic here)

# Change ownership of www directory to www-data:www-data
subprocess.run(["sudo", "chown", "-R", "www-data:www-data", "www"])

