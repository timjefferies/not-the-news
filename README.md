# not-the-news
Browser based single page scroll rss reader with keyword filtering.

Multiple rss feeds are aggregated into a single rss feed, rss items that flag up with filtered keywords are then removed.
On the website, closing an item will permanently remain closed. Hidden items are kept in localstorage

# dependencies

- Cron
- Python3
- PHP
- Nginx

Python3 modules:
- Feedparser
- Datetime
- json
- urlparse
- xml.etree.ElementTree
- hashlib


# configuration

add to crontab:

```*/30 * * * * su -c "sh /home/<user>/not-the-news/run.sh" <username>```

edit and rename the config examples in
www/config/
- feeds.txt
- filter_keywords.txt
- config.php
