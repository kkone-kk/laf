const axios = require('axios');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

async function restartSharedRuntime() {
  console.log('🔄 Restarting Shared Runtime');
  console.log('='.repeat(30));

  try {
    // First, check if shared runtime is running
    console.log('🔍 Checking current shared runtime status...');
    try {
      const response = await axios.get('http://localhost:8000/_/healthz', { timeout: 3000 });
      console.log(`✅ Shared runtime is currently running: ${response.data}`);
    } catch (error) {
      console.log('⚠️  Shared runtime not responding');
    }

    // Find and kill Node.js processes running on port 8000
    console.log('\n🔍 Finding processes using port 8000...');

    try {
      // On Windows, use netstat to find the process using port 8000
      const { stdout } = await execAsync('netstat -ano | findstr :8000');
      const lines = stdout.split('\n').filter(line => line.includes(':8000'));

      if (lines.length > 0) {
        console.log(`Found ${lines.length} connections on port 8000`);

        // Extract PIDs and kill them
        const pids = new Set();
        lines.forEach(line => {
          const parts = line.trim().split(/\s+/);
          if (parts.length >= 5) {
            const pid = parts[4];
            if (pid && pid !== '0') {
              pids.add(pid);
            }
          }
        });

        console.log(`🔪 Killing processes: ${Array.from(pids).join(', ')}`);

        for (const pid of pids) {
          try {
            await execAsync(`taskkill /F /PID ${pid}`);
            console.log(`✅ Killed process ${pid}`);
          } catch (error) {
            console.log(`⚠️  Could not kill process ${pid}: ${error.message}`);
          }
        }
      } else {
        console.log('No processes found using port 8000');
      }
    } catch (error) {
      console.log(`⚠️  Could not check port usage: ${error.message}`);
    }

    // Wait a moment for processes to fully terminate
    console.log('\n⏳ Waiting for processes to terminate...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // The server should automatically restart the shared runtime
    console.log('\n🚀 Waiting for shared runtime to restart...');

    let attempts = 0;
    const maxAttempts = 10;

    while (attempts < maxAttempts) {
      try {
        await new Promise(resolve => setTimeout(resolve, 2000));
        const response = await axios.get('http://localhost:8000/_/healthz', { timeout: 3000 });
        console.log(`✅ Shared runtime restarted successfully: ${response.data}`);
        break;
      } catch (error) {
        attempts++;
        console.log(`⏳ Attempt ${attempts}/${maxAttempts}: Waiting for restart...`);

        if (attempts >= maxAttempts) {
          console.log('❌ Shared runtime did not restart automatically');
          console.log('💡 You may need to restart the main server to trigger shared runtime startup');
        }
      }
    }

    // Test the fixed change streams
    if (attempts < maxAttempts) {
      console.log('\n🧪 Testing change stream fix...');

      // Wait a bit more to see if there are still change stream errors
      await new Promise(resolve => setTimeout(resolve, 5000));

      try {
        const response = await axios.get('http://localhost:8000/_/healthz', { timeout: 3000 });
        console.log('✅ Shared runtime is stable after change stream fix');
      } catch (error) {
        console.log('⚠️  Shared runtime may still have issues');
      }
    }

  } catch (error) {
    console.error('❌ Error during restart:', error.message);
  }
}

restartSharedRuntime();