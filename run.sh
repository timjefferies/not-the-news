python3 merge_feeds.py
python3 filter_feed.py
sed -i 's/twitter.com/nitter.net/g' /tmp/filtered_feed.xml;
sed -i 's/img src/img loading="lazy" src/g' /tmp/filtered_feed.xml; # lazy load images
sed -i 's/<br>/<br><br>/g' /tmp/filtered_feed.xml;
sed -i 's/www.reddit/old.reddit/g' /tmp/filtered_feed.xml;
mkdir -p www/data
python3 make_html.py
#minify www/data/final-rss.html
sudo chown -R www-data:www-data www
