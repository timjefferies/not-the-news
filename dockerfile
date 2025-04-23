# ── 1. Base image
FROM caddy:2-alpine

# ── 2. Accept domain and email as build args
ARG DOMAIN
ARG EMAIL

# ── 3. Set environment variables so Caddy can access them
ENV DOMAIN=${DOMAIN}
ENV EMAIL=${EMAIL}

# ── 4. Install Python, Bash, Feedparser, etc.
RUN apk add --no-cache \
      python3 \
      py3-feedparser \
      bash \
      procps \
      ca-certificates \
    && update-ca-certificates

# ── 5. Set workdir and copy your source code
WORKDIR /app
COPY run.py merge_feeds.py watchdog.sh www/ ./

# ── 6. Copy the Caddyfile into the right place
COPY Caddyfile /etc/caddy/Caddyfile

# ── 7. Make scripts executable
RUN chmod +x watchdog.sh run.py

# ── 8. Expose HTTP & HTTPS
EXPOSE 80 443

# ── 9. Launch both the RSS merger and the web server
CMD ["sh", "-c", "\
    while true; do \
      ./watchdog.sh; \
      sleep 300; \
    done & \
    exec caddy run --config /etc/caddy/Caddyfile --adapter caddyfile \
"]

