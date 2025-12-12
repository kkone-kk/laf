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
3. Start the NestJS server in development mode on port 3000.

### 3. Start the Web Frontend

Open a new terminal to start the frontend.

```bash
cd web
npm install
# Point to your local server
export VITE_DEV_SERVER_URL=http://localhost:3000
npm run dev
```

Visit `http://localhost:5273` (or the port shown by vite).

**Login**: Authentication is mocked. You can enter any username/password (e.g., admin/admin), and it will log you in as a default admin user.

### 4. Accessing Functions

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

## Notes for Production

**WARNING**: This mode is designed for **local development** or **private single-tenant** use. It removes significant security and reliability layers provided by Kubernetes:

1.  **Isolation**: User functions run as child processes of the server user. There is **NO** container isolation. Malicious code can access the server's file system and environment.
2.  **Authentication**: Authentication is **DISABLED/MOCKED**. Anyone with network access to the API can act as admin.
3.  **Reliability**: There is no automatic restart on crash (beyond basic Node logic), no resource limits (CPU/RAM), and no horizontal scaling.
4.  **Logging**: Logs are printed to stdout and are not persisted or rotated.

If you intend to use this in a "production" environment, ensure it is strictly internal, trusted, and secured by an external firewall.
