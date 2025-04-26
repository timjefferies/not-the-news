# 1. Base: Caddy v2 on Alpine
FROM caddy:2-alpine

# 2. Build args
ARG DOMAIN
ARG EMAIL
ENV DOMAIN=${DOMAIN} EMAIL=${EMAIL}

# 3. Runtime deps: Python, feedparser, scripts, CA certs
RUN apk add --no-cache \
      python3 \
      py3-pip \
      py3-feedparser \
      bash \
      procps \
      ca-certificates \
    && update-ca-certificates \
    && pip3 install feedgen

# 4. Copy app code
WORKDIR /app
COPY rss/ /rss/

# 5. Copy static site & existing feed data
COPY www/ /app/www/
COPY data/ /data/

# 7. Generate a *single* site block—Caddy will auto-enable HTTPS
RUN cat <<EOF > /etc/caddy/Caddyfile
{
  # Global options: register LE email
  email ${EMAIL}
  
  # set letsencrypt to staging while testing
  acme_ca https://acme-staging-v02.api.letsencrypt.org/directory
}

${DOMAIN} {
  # Default: serve your static site
  root * /app/www
  file_server

  # Special case: /feed.xml → data/feed/feed.xml
  @feed {
    path /feed.xml
  }
  handle @feed {
    root * /data/feed
    
    # allow any origin to fetch the feed, and expose caching headers
    header {
      Access-Control-Allow-Origin   *
      Access-Control-Expose-Headers ETag, Last-Modified
    }
    file_server
  }
}
EOF

# 8. Expose standard HTTP(S) ports
EXPOSE 80 443

# 9. Start the RSS updater loop, then run Caddy
CMD ["sh","-c","\
    python3 /rss/run.py --daemon & \
    exec caddy run --config /etc/caddy/Caddyfile --adapter caddyfile\
"]
