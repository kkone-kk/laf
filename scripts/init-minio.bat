@echo off
echo Waiting for MinIO to be ready...
timeout /t 10 /nobreak > nul

echo Downloading MinIO client...
if not exist "mc.exe" (
    curl -L https://dl.min.io/client/mc/release/windows-amd64/mc.exe -o mc.exe
)

echo Configuring MinIO client...
mc.exe alias set local http://localhost:9000 minioadmin minioadmin

echo Creating buckets...
mc.exe mb local/laf --ignore-existing
mc.exe mb local/screenshots --ignore-existing

echo Setting bucket policies...
mc.exe anonymous set public local/screenshots

echo MinIO initialization completed!
echo MinIO Console: http://localhost:9001
echo MinIO API: http://localhost:9000
echo Username: minioadmin
echo Password: minioadmin

pause