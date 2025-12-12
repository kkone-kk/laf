#!/bin/bash

echo "Starting LAF services..."

echo "Starting Docker services..."
docker-compose up -d

echo "Waiting for services to be ready..."
sleep 15

echo "Initializing MinIO..."
bash scripts/init-minio.sh

echo "All services started successfully!"
echo ""
echo "Services:"
echo "- MongoDB: mongodb://admin:123456@localhost:27017"
echo "- MinIO API: http://localhost:9000"
echo "- MinIO Console: http://localhost:9001"
echo ""
echo "To stop services, run: docker-compose down"