#!/usr/bin/env node

const { spawn } = require('child_process');
const net = require('net');

console.log('🔧 Testing Final Fixes Implementation');
console.log('====================================');

// Test port availability
async function checkPortAvailability(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on('error', () => resolve(false));
  });
}

// Kill any existing processes on our ports
async function killProcessesOnPorts() {
  console.log('\n🧹 Cleaning up existing processes...');

  const ports = [8000, 8082, 9002, 9012];
  for (const port of ports) {
    try {
      const { spawn } = require('child_process');
      const netstat = spawn('netstat', ['-ano'], { shell: true });
      let output = '';

      netstat.stdout.on('data', (data) => {
        output += data.toString();
      });

      await new Promise((resolve) => {
        netstat.on('close', () => {
          const lines = output.split('\n');
          const portLine = lines.find(line => line.includes(`:${port} `));
          if (portLine) {
            const parts = portLine.trim().split(/\s+/);
            const pid = parts[parts.length - 1];
            if (pid && pid !== '0') {
              console.log(`Killing process ${pid} using port ${port}`);
              try {
                process.kill(parseInt(pid), 'SIGTERM');
              } catch (e) {
                // Process might already be dead
              }
            }
          }
          resolve();
        });
      });
    } catch (error) {
      // Ignore errors in cleanup
    }
  }

  // Wait for cleanup
  await new Promise(resolve => setTimeout(resolve, 2000));
}

// Test server startup
async function testServerStartup() {
  return new Promise((resolve) => {
    console.log('\n📡 Testing server startup...');

    const server = spawn('npm', ['run', 'dev'], {
      cwd: './server',
      stdio: 'pipe',
      shell: true
    });

    let output = '';
    let errors = [];
    let serverStarted = false;
    let changeStreamHandled = false;
    let portConflicts = false;
    let multipleRuntimes = false;

    const timeout = setTimeout(() => {
      server.kill();
      resolve({
        success: serverStarted && changeStreamHandled && !portConflicts && !multipleRuntimes,
        output: output,
        errors: errors,
        results: {
          serverStarted,
          changeStreamHandled,
          portConflicts,
          multipleRuntimes
        }
      });
    }, 20000);

    server.stdout.on('data', (data) => {
      const text = data.toString();
      output += text;

      if (text.includes('Nest application successfully started')) {
        serverStarted = true;
      }

      if (text.includes('Change streams not supported') &&
        text.includes('MongoDB is not running as a replica set')) {
        changeStreamHandled = true;
      }

      if (text.includes('Storage server') && text.includes('listened on')) {
        console.log('✅ Storage server started successfully');
      }

      if (text.includes('Shared runtime started on port')) {
        console.log('✅ Shared runtime started successfully');
      }
    });

    server.stderr.on('data', (data) => {
      const text = data.toString();
      output += text;

      if (text.includes('EADDRINUSE')) {
        portConflicts = true;
        errors.push('Port conflict detected');
      }

      if (text.includes('$changeStream stage is only supported on replica sets')) {
        errors.push('Change stream error not handled');
      }

      // Check for multiple runtime instances
      const runtimeMatches = (output.match(/Storage server.*listened on/g) || []).length;
      if (runtimeMatches > 1) {
        multipleRuntimes = true;
        errors.push('Multiple runtime instances detected');
      }
    });

    server.on('close', () => {
      clearTimeout(timeout);
      resolve({
        success: serverStarted && changeStreamHandled && !portConflicts && !multipleRuntimes,
        output: output,
        errors: errors,
        results: {
          serverStarted,
          changeStreamHandled,
          portConflicts,
          multipleRuntimes
        }
      });
    });
  });
}

async function runTests() {
  console.log('\n🔍 Step 1: Cleaning up existing processes...');
  await killProcessesOnPorts();

  console.log('\n🔍 Step 2: Checking port availability...');
  const ports = [8000, 8082, 9002, 9012];
  for (const port of ports) {
    const available = await checkPortAvailability(port);
    console.log(`Port ${port} available: ${available ? '✅' : '❌'}`);
  }

  console.log('\n🔍 Step 3: Testing server startup and fixes...');
  const serverTest = await testServerStartup();

  console.log('\n📊 Test Results:');
  console.log('================');
  console.log(`Server started: ${serverTest.results.serverStarted ? '✅' : '❌'}`);
  console.log(`Change streams handled: ${serverTest.results.changeStreamHandled ? '✅' : '❌'}`);
  console.log(`No port conflicts: ${!serverTest.results.portConflicts ? '✅' : '❌'}`);
  console.log(`Single runtime instance: ${!serverTest.results.multipleRuntimes ? '✅' : '❌'}`);
  console.log(`Overall success: ${serverTest.success ? '✅' : '❌'}`);

  if (serverTest.errors.length > 0) {
    console.log('\n❌ Issues detected:');
    serverTest.errors.forEach(error => console.log(`- ${error}`));
  }

  if (serverTest.success) {
    console.log('\n🎉 All fixes working correctly!');
    console.log('✅ MongoDB Change Stream errors resolved');
    console.log('✅ Port conflicts resolved');
    console.log('✅ Multiple runtime instances prevented');
    console.log('✅ Server starts successfully');
  } else {
    console.log('\n📝 Server output (last 50 lines):');
    const lines = serverTest.output.split('\n');
    console.log(lines.slice(-50).join('\n'));
  }
}

runTests().catch(console.error);