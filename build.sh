#!/bin/bash

# Help function
usage() {
    echo "Usage: $0 -d DOMAIN -e EMAIL [-p PASSWORD]"
    echo
    echo "Options:"
    echo "  -d DOMAIN    Domain name for the service (e.g., news.yourwebsite.net)"
    echo "  -e EMAIL     Email for Let's Encrypt certificate notifications"
    echo "  -p PASSWORD  [Optional] Password for site protection"
    echo "  -h           Show this help message"
    exit 1
}

# Parse command-line arguments
while getopts ":d:e:p:h" opt; do
    case $opt in
        d) DOMAIN="$OPTARG" ;;
        e) EMAIL="$OPTARG" ;;
        p) PASSWORD="$OPTARG" ;;
        h) usage ;;
        \?) echo "Invalid option -$OPTARG" >&2; usage ;;
        :) echo "Option -$OPTARG requires an argument" >&2; usage ;;
    esac
done

# Validate required arguments
if [[ -z "$DOMAIN" || -z "$EMAIL" ]]; then
    echo "Error: Both domain (-d) and email (-e) are required!"
    echo
    usage
fi

# Create docker volume if not exists
sudo docker volume inspect not-the-news_volume >/dev/null 2>&1 || sudo docker volume create not-the-news_volume

# Build command components
BUILD_ARGS="--build-arg DOMAIN=\"$DOMAIN\" --build-arg EMAIL=\"$EMAIL\""
if [ -n "$PASSWORD" ]; then
    BUILD_ARGS+=" --build-arg CADDY_PASSWORD=\"$PASSWORD\""
fi

# Build and run
git pull && \
    sudo docker rm -f ntn && \
    sudo docker container prune -f && \
    sudo docker buildx build $BUILD_ARGS -t not-the-news . && \
    sudo docker run -d -p 80:80 -p 443:443 -v not-the-news_volume:/data --name ntn not-the-news

# Optional Cleanup
#sudo docker image prune -f
#sudo docker builder prune -f
#docker buildx rm caddy-builder --force
