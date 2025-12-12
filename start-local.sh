#!/bin/bash

# Laf Local Development Startup Script

echo "Starting Laf Local Development Environment..."

# Check if runtime is built
if [ ! -d "runtimes/nodejs/dist" ]; then
    echo "Building Node.js runtime..."
    cd runtimes/nodejs
    npm install
    npm run build
    cd ../..
fi

# Check if server is built
if [ ! -d "server/dist" ]; then
    echo "Building server..."
    cd server
    npm install
    npm run build
    cd ..
fi

# Start the server in development mode
echo "Starting Laf server..."
cd server
npm run dev