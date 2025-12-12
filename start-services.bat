@echo off
echo Starting LAF services...

echo Starting Docker services...
docker-compose up -d

echo Waiting for services to be ready...
timeout /t 15 /nobreak > nul

echo Initializing MinIO...
if not exist "mc.exe" (
    echo Downloading MinIO client...
    powershell -Command "Invoke-WebRequest -Uri 'https://dl.min.io/client/mc/release/windows-amd64/mc.exe' -OutFile 'mc.exe'"
)

echo Configuring MinIO client...
mc.exe alias set local http://localhost:9000 minioadmin minioadmin
mc.exe alias set default http://localhost:9000 minioadmin minioadmin

echo Creating buckets...
mc.exe mb local/laf --ignore-existing
mc.exe mb local/screenshots --ignore-existing
mc.exe mb default/laf --ignore-existing
mc.exe mb default/screenshots --ignore-existing

echo Setting bucket policies...
mc.exe anonymous set public local/screenshots
mc.exe anonymous set public default/screenshots

echo All services started successfully!
echo.
echo Services:
echo - MongoDB: mongodb://admin:123456@localhost:27017
echo - MinIO API: http://localhost:9000
echo - MinIO Console: http://localhost:9001
echo.
echo To stop services, run: docker-compose down