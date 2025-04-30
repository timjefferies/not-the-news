![image](screenshot.jpg)

# not-the-news
Browser based single page scroll rss reader with keyword filtering.
Multiple rss feeds are regularly aggregated into a single scrollable feed, rss items that flag up with filtered keywords are removed.

Features:
- Keyword filtering - only see the information you want to see.
- Night/Day mode
- Auto reload in the background when new rss items are available
- Automatic cross browser/device syncing
- Feed filter modes (Unread/Starred/Hidden/All)

# configuration

edit and rename the config examples in
www/config/
- feeds.txt
- filter_keywords.txt

# running it

# Build and run the container
./build.sh -d yourdomain.com -e admin@youremail.com

# Optional - set up a cron to backup the data every 12 hours

sudo echo "0 */12 * * * cd <FOLDER WHERE NOT-THE-NEWS IS LOCATED> && sh backup.sh" >> /var/spool/cron/crontabs/root
