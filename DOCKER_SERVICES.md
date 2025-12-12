# Docker Services Setup

This document explains how to set up and run the required services (MinIO and MongoDB) using Docker.

## Prerequisites

- Docker and Docker Compose installed
- Ports 9000, 9001, and 27017 available

## Quick Start

### Windows
```bash
start-services.bat
```

### Linux/Mac
```bash
chmod +x start-services.sh
./start-services.sh
```

## Manual Setup

### 1. Start Services
```bash
docker-compose up -d
```

### 2. Initialize MinIO
Wait for services to be ready (about 15 seconds), then run:

**Windows:**
```bash
scripts\init-minio.bat
```

**Linux/Mac:**
```bash
chmod +x scripts/init-minio.sh
./scripts/init-minio.sh
```

## Service URLs

- **MinIO API**: http://localhost:9000
- **MinIO Console**: http://localhost:9001
- **MongoDB**: mongodb://admin:123456@localhost:27017

## Default Credentials

### MinIO
- Username: `minioadmin`
- Password: `minioadmin`

### MongoDB
- Username: `admin`
- Password: `123456`

## Buckets Created

- `laf` - Main application bucket
- `screenshots` - Public bucket for screenshots

## Stopping Services

```bash
docker-compose down
```

To remove all data:
```bash
docker-compose down -v
```

## Troubleshooting

### Port Conflicts
If you get port conflicts, check what's running on ports 9000, 9001, or 27017:

**Windows:**
```bash
netstat -ano | findstr :9000
netstat -ano | findstr :27017
```

**Linux/Mac:**
```bash
lsof -i :9000
lsof -i :27017
```

### MinIO Client Issues
If the MinIO client (mc) fails to download or run, you can manually download it from:
- Windows: https://dl.min.io/client/mc/release/windows-amd64/mc.exe
- Linux: https://dl.min.io/client/mc/release/linux-amd64/mc
- Mac: https://dl.min.io/client/mc/release/darwin-amd64/mc