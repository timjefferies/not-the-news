#!/bin/bash

# Configuration
BACKUP_DIR="./backup"
VOLUME_NAME="not-the-news_volume"
RETENTION_DAYS=7
TIMESTAMP=$(date +%Y-%m-%d_%H-%M-%S)

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Create backup
docker run --rm \
  -v $VOLUME_NAME:/data \
  -v "$BACKUP_DIR:/backup" \
  alpine sh -c "tar -czf /backup/ntn-backup_${TIMESTAMP}.tar.gz -C /data ."

# Delete old backups
find "$BACKUP_DIR" -name "ntn-backup_*.tar.gz" -type f -mtime +$RETENTION_DAYS -delete
