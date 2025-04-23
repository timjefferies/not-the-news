#!/bin/bash

# Dynamically set paths based on the script's location
SCRIPT_DIR=$(dirname "$(realpath "$0")")
FEED_FILE="$SCRIPT_DIR/data/feed/feed.xml"
TARGET_DIR="$SCRIPT_DIR/www"

echo "Starting feed file handler in $SCRIPT_DIR..."

# Ensure target directory exists
if [ ! -d "$TARGET_DIR" ]; then
    mkdir -p "$TARGET_DIR"
    echo "Created and set ownership for $TARGET_DIR."
fi

# Check if feed.xml exists and is older than 30 minutes
if [ -f "$FEED_FILE" ]; then
    LAST_MODIFIED=$(stat -c %Y "$FEED_FILE")
    CURRENT_TIME=$(date +%s)
    AGE=$((CURRENT_TIME - LAST_MODIFIED))

    if [ $AGE -lt 1800 ]; then
        echo "Feed file is less than 30 minutes old. Skipping script execution."
        exit 0
    fi
fi

# Check if run.py is already running
if pgrep -f "python3 $SCRIPT_DIR/run.py" > /dev/null; then
    echo "run.py is already running. Waiting for it to finish..."
    while pgrep -f "python3 $SCRIPT_DIR/run.py" > /dev/null; do
        sleep 5  # Wait for 5 seconds before checking again
    done
fi

# Run the Python script
python3 "$SCRIPT_DIR/run.py" || {
    echo "Error: Failed to run the Python script!"
    exit 1
}

# Check if feed file exists after running Python
if [ -f "$FEED_FILE" ]; then
    echo "Feed file found. Moving to $TARGET_DIR..."
    cp "$FEED_FILE" "$TARGET_DIR/feed.xml"
    chown www-data:www-data "$TARGET_DIR/feed.xml"
    chmod 644 "$TARGET_DIR/feed.xml"
    echo "File successfully moved and ownership/permissions updated."
else
    echo "Warning: $FEED_FILE does not exist. No action taken."
fi
