#!/bin/bash
set -e

# Start dependencies
echo "Please make sure MongoDB and MinIO are running."
echo "  MongoDB URL: mongodb://localhost:27017/laf"
echo "  MinIO URL: http://localhost:9000"

# Install dependencies and build
echo "Installing dependencies and building..."
npm install
npm run build

# Start server
echo "Starting server..."
cd server
npm install
# Set environment variables for local development
export DATABASE_URL="mongodb://localhost:27017/laf"
export JWT_SECRET="secret"
export API_SERVER_URL="http://localhost:3000"
export DEFAULT_REGION_RUNTIME_DOMAIN="127.0.0.1.nip.io"
export DEFAULT_REGION_WEBSITE_DOMAIN="127.0.0.1.nip.io"
# export SERVER_SECRET="secret" # needed for runtime config, passed via env

# Start nestjs server
npm run start:dev
