#!/bin/bash

# Dynamically set paths based on the script's location
SCRIPT_DIR=$(dirname "$(realpath "$0")")
FEED_FILE="$SCRIPT_DIR/data/feed/feed.xml"
TARGET_DIR="$SCRIPT_DIR/www"

echo "Starting feed file handler in $SCRIPT_DIR..."

# Ensure target directory exists
if [ ! -d "$TARGET_DIR" ]; then
    mkdir -p "$TARGET_DIR"
    chown www-data:www-data "$TARGET_DIR"
    echo "Created and set ownership for $TARGET_DIR."
fi


# Run the Python script
echo "Running Python script..."
python3 "$SCRIPT_DIR/run.py" || {
    echo "Error: Failed to run the Python script!"
    exit 1
}

# Check if feed file exists after running Python
if [ -f "$FEED_FILE" ]; then
    echo "Feed file found. Moving to $TARGET_DIR..."
    cp "$FEED_FILE" "$TARGET_DIR/feed.xml"  # Rename in case of duplication
    chown www-data:www-data "$TARGET_DIR/feed.xml"  # Ensure correct ownership
    chmod 644 "$TARGET_DIR/feed.xml"  # Set permissions for readability
    echo "File successfully moved and ownership/permissions updated."
else
    echo "Warning: $FEED_FILE does not exist. No action taken."
fi
