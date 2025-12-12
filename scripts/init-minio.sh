#!/bin/bash

# MinIO initialization script
# This script creates the necessary buckets for the LAF application

echo "Waiting for MinIO to be ready..."
sleep 10

# Install mc (MinIO Client) if not available
if ! command -v mc &> /dev/null; then
    echo "Installing MinIO client..."
    curl https://dl.min.io/client/mc/release/linux-amd64/mc -o /usr/local/bin/mc
    chmod +x /usr/local/bin/mc
fi

# Configure MinIO client
mc alias set local http://localhost:9000 minioadmin minioadmin

# Create buckets
echo "Creating buckets..."
mc mb local/laf --ignore-existing
mc mb local/screenshots --ignore-existing

# Set bucket policies (public read for screenshots)
mc anonymous set public local/screenshots

echo "MinIO initialization completed!"
echo "MinIO Console: http://localhost:9001"
echo "MinIO API: http://localhost:9000"
echo "Username: minioadmin"
echo "Password: minioadmin"