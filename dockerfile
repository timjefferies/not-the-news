# syntax=docker/dockerfile:1.4
##############################################################################
# 1. Base image
FROM caddy:2-alpine

##############################################################################
# 2. Build args & env
ARG DOMAIN
ARG EMAIL
ENV DOMAIN=${DOMAIN} \
    EMAIL=${EMAIL} \
    ACME_CA=https://acme-v02.api.letsencrypt.org/directory

##############################################################################
# 3. System deps
RUN apk add --no-cache \
      bash procps python3 py3-pip py3-virtualenv ca-certificates \
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
# 5. Copy code & initial data
WORKDIR /app
COPY rss/ /rss/
COPY www/ /app/www/
COPY data/ /data/feed/

##############################################################################
# 6. Build entrypoint with echo
RUN mkdir -p /usr/local/bin && \
    echo '#!/usr/bin/env bash' > /usr/local/bin/docker-entrypoint.sh && \
    echo 'set -e' >> /usr/local/bin/docker-entrypoint.sh && \
    echo '' >> /usr/local/bin/docker-entrypoint.sh && \
    echo 'python3 /app/www/api.py &' >> /usr/local/bin/docker-entrypoint.sh && \
    echo 'python3 /rss/run.py --daemon &' >> /usr/local/bin/docker-entrypoint.sh && \
    echo '' >> /usr/local/bin/docker-entrypoint.sh && \
    echo 'if [ ! -f "/data/autosave.json" ]; then' >> /usr/local/bin/docker-entrypoint.sh && \
    echo '  echo "[entrypoint] No existing cert state—provisioning…"' >> /usr/local/bin/docker-entrypoint.sh && \
    echo '  if ! caddy run --config /etc/caddy/Caddyfile --adapter caddyfile --environ --watch; then' >> /usr/local/bin/docker-entrypoint.sh && \
    echo '    echo "[entrypoint] ACME failed—switching to STAGING CA"' >> /usr/local/bin/docker-entrypoint.sh && \
    echo '    export ACME_CA=https://acme-staging-v02.api.letsencrypt.org/directory' >> /usr/local/bin/docker-entrypoint.sh && \
    echo '  fi' >> /usr/local/bin/docker-entrypoint.sh && \
    echo 'fi' >> /usr/local/bin/docker-entrypoint.sh && \
    echo '' >> /usr/local/bin/docker-entrypoint.sh && \
    echo 'exec caddy run --config /etc/caddy/Caddyfile --adapter caddyfile' >> /usr/local/bin/docker-entrypoint.sh && \
    chmod +x /usr/local/bin/docker-entrypoint.sh

##############################################################################
# 7. copy Caddyfile (persist to /data, allow ACME_CA override)
COPY Caddyfile /etc/caddy/Caddyfile

##############################################################################
# 8. Declare the data volume & expose ports
VOLUME /data
EXPOSE 80 443 3000

##############################################################################
# 9. Entrypoint + default CMD
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]

