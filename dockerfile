# syntax=docker/dockerfile:1.4
##############################################################################
# 1. Base image
FROM caddy:2-alpine

##############################################################################
# 2. Build args → env
ARG DOMAIN
ARG EMAIL
# Default production CA; entrypoint may override to staging
ENV DOMAIN=${DOMAIN} \
    EMAIL=${EMAIL} \
    ACME_CA=https://acme-v02.api.letsencrypt.org/directory

##############################################################################
# 3. System deps
RUN apk add --no-cache \
      python3 py3-pip py3-virtualenv bash procps ca-certificates \
    && update-ca-certificates

##############################################################################
# 4. Python venv & packages
RUN python3 -m venv /venv
ENV PATH="/venv/bin:$PATH"
RUN pip install \
      feedparser feedgen requests python-dateutil \
      Flask==2.2.5 Werkzeug==2.3.7 bleach markdown \
    && rm -rf /root/.cache/pip

##############################################################################
# 5. Copy code + initial feed data
WORKDIR /app
COPY rss/ /rss/
COPY www/ /app/www/
COPY data/ /data/feed/

##############################################################################
# 6. Inline entrypoint (starts Python, does one-shot ACME, then runs Caddy)
RUN << 'EOF' > /usr/local/bin/docker-entrypoint.sh
#!/usr/bin/env bash
set -e

# 1) Start backends
python3 /app/www/api.py &
python3 /rss/run.py --daemon &

# 2) If no cert JSON exists, try to provision once
#    Caddy writes to /data by default (we override storage below)
if [ ! -f "/data/autosave.json" ]; then
  echo "[entrypoint] No existing cert state—provisioning…"
  if ! caddy run --config /etc/caddy/Caddyfile --adapter caddyfile --environ --watch; then
    echo "[entrypoint] PRODUCTION ACME failed—switching to STAGING CA"
    export ACME_CA=https://acme-staging-v02.api.letsencrypt.org/directory
  fi
fi

# 3) Exec the real Caddy
exec caddy run --config /etc/caddy/Caddyfile --adapter caddyfile
EOF
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

##############################################################################
# 7. Generate Caddyfile (uses env vars & custom storage path)
RUN <<EOF > /etc/caddy/Caddyfile
{
  # your email for LE
  email {env.EMAIL}

  # store all ACME state under /data so it survives rebuilds
  storage file_system /data

  # point at production or staging based on ENTRYPOINT export
  acme_ca {env.ACME_CA}
}

${DOMAIN} {
  handle /load-state* { reverse_proxy 127.0.0.1:3000 }
  handle /save-state* { reverse_proxy 127.0.0.1:3000 }

  # default site
  root * /app/www
  file_server

  # serve /feed.xml from persisted feed data
  @feed path /feed.xml
  handle @feed {
    root * /data/feed
    header {
      Access-Control-Allow-Origin   *
      Access-Control-Expose-Headers ETag, Last-Modified
    }
    file_server
  }
}
EOF

##############################################################################
# 8. Declare & expose
VOLUME /data                 # mount a named volume here for both app & certs :contentReference[oaicite:3]{index=3}
EXPOSE 80 443 3000

##############################################################################
# 9. Entrypoint + default command
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]

