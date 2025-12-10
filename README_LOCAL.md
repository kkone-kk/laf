# Local Deployment Guide (Microservices Architecture)

This branch converts the `laf` server to a pure local microservice architecture, removing dependencies on Kubernetes and Docker for the runtime environment.

## Prerequisites

Ensure you have the following installed on your local machine:
- Node.js (v18+)
- MongoDB (v4.4+)
- MinIO (S3 compatible object storage)
- npm or pnpm

## Configuration

### Environment Variables

The system relies on several environment variables. A helper script `start-local.sh` is provided, but you should understand the key configurations:

- `DATABASE_URL`: Connection string for MongoDB (e.g., `mongodb://localhost:27017/laf`). The system will automatically generate app-specific database names based on this URL.
- `API_SERVER_URL`: The URL where the `laf-server` is listening (e.g., `http://localhost:3000`).
- `DEFAULT_REGION_RUNTIME_DOMAIN`: Domain suffix for runtimes. For local development, use `127.0.0.1.nip.io`.
- `DEFAULT_REGION_WEBSITE_DOMAIN`: Domain suffix for static websites. Use `127.0.0.1.nip.io`.
- `OSS_*`: MinIO configuration (handled in the startup script or `.env`).

### Dependencies

1. **MongoDB**: Start a local MongoDB instance on port 27017.
2. **MinIO**: Start a local MinIO instance on port 9000. Create a bucket named `laf` (or as configured).

## How to Run

### 1. Build the Runtime

The runtime is the Node.js environment that executes user functions. It must be built first.

```bash
cd runtimes/nodejs
npm install
npm run build
```

### 2. Start the Server

We provide a convenience script `start-local.sh` in the root directory.

```bash
chmod +x start-local.sh
./start-local.sh
```

This script will:
1. Install dependencies for the server.
2. Build the server.
3. Start the NestJS server in development mode.

### 3. Accessing Functions

The system includes a **Local Gateway** running on port **8080**.

When you create an application (e.g., `appid: testapp`), you can access its functions via:

```
http://testapp.127.0.0.1.nip.io:8080/<function-name>
```

Ensure your DNS resolves `*.127.0.0.1.nip.io` to `127.0.0.1` (this is standard behavior for nip.io).

## Architecture Changes

- **ProcessManagerService**: Replaces Kubernetes Pods. It spawns `node` processes directly on the host for each application.
- **LocalGatewayService**: Replaces Kubernetes Ingress. A reverse proxy on port 8080 routes requests to the appropriate local process.
- **CronJobService**: Uses `node-cron` to schedule tasks locally.
- **Database**: Uses a single local MongoDB instance. Each application gets its own logical database derived from the main `DATABASE_URL`.

## Notes

- **Logs**: Function logs are currently output to the server's stdout/console.
- **Security**: This mode is intended for local development and testing. Process isolation is minimal compared to containers.
