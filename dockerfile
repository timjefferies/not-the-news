# 1. Base: Caddy v2 on Alpine
FROM caddy:2-alpine

# 2. Build args
ARG DOMAIN
ARG EMAIL
ENV DOMAIN=${DOMAIN} EMAIL=${EMAIL}

# 3. Runtime deps: Python, feedparser, scripts, CA certs
RUN apk add --no-cache \
      python3 \
      py3-feedparser \
      bash \
      procps \
      ca-certificates \
    && update-ca-certificates

# 4. Copy app code
WORKDIR /app
COPY run.py merge_feeds.py clean_feed.py filter_feed.py /rss/

# 5. Copy static site & existing feed data
COPY www/ /app/www/
COPY data/ /app/data/

# 6. Generate a *single* site block—Caddy will auto-enable HTTPS
RUN cat <<EOF > /etc/caddy/Caddyfile
{
  # Global options block: register LE email
  email ${EMAIL}
}

${DOMAIN} {
  root * /app/www
  file_server
}
EOF

# 8. Expose standard HTTP(S) ports
EXPOSE 80 443

# 9. Start the RSS updater loop, then run Caddy
CMD ["sh","-c","\
    python3 ./rss/run.py --daemon & \
    exec caddy run --config /etc/caddy/Caddyfile --adapter caddyfile\
"]
