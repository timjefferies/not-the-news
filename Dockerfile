# Base image
FROM nginx:latest

# Install dependencies
RUN apt-get update && apt-get install -y \
    cron \
    python3 \
    python3-feedparser \
    python3-dateutil \
    python3-urllib3

# Add repository for PHP 8.2
RUN add-apt-repository ppa:ondrej/php && apt-get update

# Install PHP 8.2 and PHP-FPM
RUN apt-get install -y php8.2 php8.2-fpm

# Copy website files to container
COPY website /usr/share/nginx/html
COPY nginx/sites-available/news /etc/nginx/sites-enabled/

# Copy python files to container
COPY not-the-news /root/not-the-news

# set up cron
RUN crontab -l | { cat; echo "*/30 * * * * su -s /bin/bash -c 'python3 /root/not-the-news/run.py' root"; } | crontab -

# Expose port 443
EXPOSE 443

# Start Nginx, PHP-FPM, and cron
CMD service cron start && service nginx start && service php8.2-fpm start && tail -f /dev/null

