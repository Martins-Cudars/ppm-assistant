#!/bin/bash

# Source (WSL path)
SRC="/home/martins/Projects/ppm-assistant/dist"

# Destination (mounted Windows path)
DEST="/mnt/c/Users/marti/Desktop/ppm"

# Create destination if it doesn't exist
mkdir -p "$DEST"

# Sync files
rsync -av --delete "$SRC/" "$DEST/"

echo "✅ Extension synced to Windows Desktop at $DEST"
