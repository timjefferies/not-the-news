# ── 1. Base image: Caddy 2 on Alpine
FROM caddy:2-alpine

# ── 2. Accept DOMAIN and EMAIL at build time
ARG DOMAIN
ARG EMAIL

# ── 3. Export those into the container’s env so Caddy can see them
ENV DOMAIN=${DOMAIN}
ENV EMAIL=${EMAIL}

# ── 4. Install Python, Pip, Bash, procps, and CA certs
RUN apk add --no-cache \
      python3 \
      py3-pip \
      bash \
      procps \
      ca-certificates \
    && update-ca-certificates

# ── 5. Set workdir and copy your app code
WORKDIR /app
COPY run.py merge_feeds.py watchdog.sh www/ ./

# ── 6. Upgrade pip and install Python deps
RUN pip3 install --no-cache-dir --upgrade pip \
 && pip3 install --no-cache-dir feedparser

# ── 7. Copy your Caddyfile into place
#    (make sure ./Caddyfile exists next to this Dockerfile)
COPY Caddyfile Caddyfile

# ── 8. Make your scripts executable
RUN chmod +x watchdog.sh run.py

# ── 9. Expose HTTP & HTTPS ports
EXPOSE 80 443

# ── 10. Start feed-watchdog in the background, then Caddy in the foreground
CMD ["sh", "-c", "\
    while true; do \
      ./watchdog.sh; \
      sleep 300; \
    done & \
    exec caddy run --config /etc/caddy/Caddyfile --adapter caddyfile \
"]

