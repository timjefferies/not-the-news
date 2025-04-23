![image](screenshot.jpg)

# not-the-news
Browser based single page scroll rss reader with keyword filtering.

Multiple rss feeds are aggregated into a single rss feed, rss items that flag up with filtered keywords are then removed.
On the website, closing an item will permanently remain closed. Hidden items are kept in localstorage

# configuration

edit and rename the config examples in
www/config/
- feeds.txt
- filter_keywords.txt
- config.php

# running it
docker buildx build -t not-the-news .
