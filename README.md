![image](screenshot.jpg)

# not-the-news
Browser based single page scroll rss reader with keyword filtering.
Multiple rss feeds are regularly aggregated into a single scrollable feed, rss items that flag up with filtered keywords are removed.

Features:
- Keyword filtering - only see the information you want to see.
- Night/Day mode
- Auto reload in the background when new rss items are available
- Automatic cross browser/device syncing

# configuration

edit and rename the config examples in
www/config/
- feeds.txt
- filter_keywords.txt
- config.php

# running it

## Create a persistent storage volume for the data
docker volume create not-the-news_volume

# Build and run the container
docker buildx build --build-arg DOMAIN=yourdomain.tld --build-arg EMAIL=you@yourdomain.tld -t not-the-news .
docker run -d -p 80:80 -p 443:443 -p 3000:3000 -v not-the-news_volume:/data --name ntn not-the-news

# Optional - set up a cron to backup the data every 12 hours

sudo echo "0 */12 * * * cd <FOLDER WHERE NOT-THE-NEWS IS LOCATED> && sh backup.sh" >> /var/spool/cron/crontabs/root
