# 1. Base: Caddy v2 on Alpine
FROM caddy:2-alpine

# 2. Build args
ARG DOMAIN
ARG EMAIL
ENV DOMAIN=${DOMAIN} EMAIL=${EMAIL}

# 3. Install system packages
RUN apk add --no-cache \
      python3 \
      py3-pip \
      py3-virtualenv \
      bash \
      procps \
      ca-certificates \
    && update-ca-certificates

# 4. Set up virtualenv
RUN python3 -m venv /venv
ENV PATH="/venv/bin:$PATH"

# 5. Install Python packages inside venv
RUN pip install feedparser feedgen requests python-dateutil Flask==2.0.3 \
    && rm -rf /root/.cache/pip

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
EXPOSE 80 443 3000

# 9. Start the RSS updater loop, then run Caddy
CMD ["sh","-c","\
    python3 /app/www/api.py & \
    python3 /rss/run.py --daemon & \
    exec caddy run --config /etc/caddy/Caddyfile --adapter caddyfile\
"]
