# not-the-news
Browser based single page scroll rss reader with keyword filtering.

# configuration

add to crontab:

```*/30 * * * * su -c "sh /home/<user>/not-the-news/run.sh" <username>```

edit and rename the config examples in
www/config/
- feeds.txt
- filter_keywords.txt
- config.php
