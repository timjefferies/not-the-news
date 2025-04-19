#!/bin/bash

# Exit immediately if a command exits with a non-zero status
set -e

# Check if the script is run as root
if [ "$EUID" -ne 0 ]; then
    echo "Error: This script must be run as root. Use sudo to execute the script."
    exit 1
fi

# Define paths
SCRIPT_DIR=$(dirname "$(realpath "$0")")
WATCHDOG_SCRIPT="$SCRIPT_DIR/watchdog.sh"
SERVICE_FILE="/etc/systemd/system/not-the-news-watchdog.service"
TIMER_FILE="/etc/systemd/system/not-the-news-watchdog.timer"

# Check if watchdog.sh exists
if [ ! -f "$WATCHDOG_SCRIPT" ]; then
    echo "Error: watchdog.sh not found in $SCRIPT_DIR. Please ensure it exists before running this script."
    exit 1
fi

# Ensure watchdog.sh is executable
echo "Setting executable permissions for $WATCHDOG_SCRIPT..."
chmod +x "$WATCHDOG_SCRIPT"

# Create the systemd service file
echo "Creating systemd service..."
sudo bash -c "cat > $SERVICE_FILE" <<EOF
[Unit]
Description=Not-the-News Watchdog Service: Run watchdog.sh script
After=network.target

[Service]
ExecStart=$WATCHDOG_SCRIPT
WorkingDirectory=$SCRIPT_DIR
Restart=on-failure

[Install]
WantedBy=multi-user.target
EOF

# Create the systemd timer file
echo "Creating systemd timer..."
sudo bash -c "cat > $TIMER_FILE" <<EOF
[Unit]
Description=Timer for Not-the-News Watchdog Service

[Timer]
OnCalendar=*:0/30
Persistent=true

[Install]
WantedBy=timers.target
EOF

# Reload systemd and enable the service and timer
echo "Enabling service and timer..."
sudo systemctl daemon-reload
sudo systemctl enable not-the-news-watchdog.service
sudo systemctl enable not-the-news-watchdog.timer
sudo systemctl start not-the-news-watchdog.timer

# Print the status of the timer
echo "Setup complete. Use the commands below to check the status of the service and timer:"
echo "sudo systemctl status not-the-news-watchdog.service"
echo "sudo systemctl status not-the-news-watchdog.timer"
