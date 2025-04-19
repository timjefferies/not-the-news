#!/usr/bin/env python3
import os
import pwd
import grp
import sys
import subprocess

# Define paths for feed directory and files
feed_dir = '/tmp/feed/'
merged_file = os.path.join(feed_dir, 'merged_feed.xml')
filtered_file = os.path.join(feed_dir, 'feed.xml')
keywords_path = 'www/config/filter_keywords.txt'

#!/usr/bin/env python3
import os
import pwd
import grp
import sys

# Define path for the feed directory
feed_dir = '/tmp/feed'

# Retrieve numeric user ID and group ID for 'azureuser' and 'www-data'
try:
    uid_azureuser = pwd.getpwnam('azureuser').pw_uid  # UID of 'azureuser'
    gid_www_data = grp.getgrnam('www-data').gr_gid    # GID of 'www-data'
except KeyError:
    sys.exit("Error: User 'azureuser' or group 'www-data' does not exist on this system.")

# Check if /tmp/feed exists
print('Setting up work folder...')
if os.path.exists(feed_dir):
    # Get the current ownership and permissions of the directory
    stat_info = os.stat(feed_dir)
    current_uid = stat_info.st_uid
    current_gid = stat_info.st_gid
    permissions = stat_info.st_mode & 0o777  # Extract permission bits
    setgid_bit = stat_info.st_mode & 0o2000  # Check for setgid bit

    # Check if ownership and permissions are correct
    if current_uid != uid_azureuser or current_gid != gid_www_data or permissions != 0o770 or setgid_bit != 0o2000:
        print(f"Error: {feed_dir} is not configured correctly.")
        print("Ownership and permissions should be set as follows:")
        print("Owner: azureuser, Group: www-data, Permissions: 2770 (including setgid bit)")
        print("\nAdd this to your root crontab to fix it:")
        print("@reboot [ -d /tmp/feed ] || (sudo mkdir -p /tmp/feed && sudo chown azureuser:www-data /tmp/feed && sudo chmod 2770 /tmp/feed) # make /tmp/feed and make it accessible to not-the-news")
        sys.exit(1)
else:
    print(f"Error: {feed_dir} does not exist.")
    print("\nAdd this to your root crontab to fix it:")
    print("@reboot [ -d /tmp/feed ] || (sudo mkdir -p /tmp/feed && sudo chown azureuser:www-data /tmp/feed && sudo chmod 2770 /tmp/feed) # make /tmp/feed and make it accessible to not-the-news")
    sys.exit(1)

# If everything is correct
print(f"{feed_dir} is correctly owned by azureuser:www-data and has the required permissions.")



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
subprocess.run(['python3', 'make_html.py'])

# Minify www/data/final-rss.html (implement the minification logic here)
