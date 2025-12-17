#!/usr/bin/env node

const { spawn } = require('child_process');
const net = require('net');

console.log('🔧 Testing Complete Fixes Implementation');
console.log('=====================================');

// Test 1: Check if ports 9000 and 9001 are available (should be free now)
async function checkPortAvailability(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on('error', () => resolve(false));
  });
}

// Test 2: Start server and check for Change Stream errors
async function testServerStartup() {
  return new Promise((resolve) => {
    console.log('\n📡 Testing server startup...');

    const server = spawn('npm', ['run', 'dev'], {
      cwd: './server',
      stdio: 'pipe',
      shell: true
    });

    let output = '';
    let hasChangeStreamError = false;
    let hasPortConflict = false;
    let serverStarted = false;

    const timeout = setTimeout(() => {
      server.kill();
      resolve({
        success: serverStarted && !hasChangeStreamError && !hasPortConflict,
        output: output,
        errors: {
          changeStream: hasChangeStreamError,
          portConflict: hasPortConflict,
          serverStarted: serverStarted
        }
      });
    }, 15000);

    server.stdout.on('data', (data) => {
      const text = data.toString();
      output += text;

      if (text.includes('Application is running on')) {
        serverStarted = true;
      }

      if (text.includes('Change streams not supported') ||
        text.includes('requires replica set')) {
        console.log('✅ Change stream gracefully handled for non-replica set');
      }
    });

    server.stderr.on('data', (data) => {
      const text = data.toString();
      output += text;

      if (text.includes('$changeStream stage is only supported on replica sets')) {
        hasChangeStreamError = true;
      }

      if (text.includes('EADDRINUSE') && (text.includes(':9000') || text.includes(':9001'))) {
        hasPortConflict = true;
      }
    });

    server.on('close', () => {
      clearTimeout(timeout);
      resolve({
        success: serverStarted && !hasChangeStreamError && !hasPortConflict,
        output: output,
        errors: {
          changeStream: hasChangeStreamError,
          portConflict: hasPortConflict,
          serverStarted: serverStarted
        }
      });
    });
  });
}

async function runTests() {
  console.log('\n🔍 Step 1: Checking port availability...');

  const port9000Available = await checkPortAvailability(9000);
  const port9001Available = await checkPortAvailability(9001);
  const port9002Available = await checkPortAvailability(9002);

  console.log(`Port 9000 available: ${port9000Available ? '✅' : '❌'}`);
  console.log(`Port 9001 available: ${port9001Available ? '✅' : '❌'}`);
  console.log(`Port 9002 available: ${port9002Available ? '✅' : '❌'}`);

  if (!port9002Available) {
    console.log('⚠️  Port 9002 is in use - this might cause issues');
  }

  console.log('\n🔍 Step 2: Testing server startup and error handling...');
  const serverTest = await testServerStartup();

  console.log('\n📊 Test Results:');
  console.log('================');
  console.log(`Server started successfully: ${serverTest.errors.serverStarted ? '✅' : '❌'}`);
  console.log(`No Change Stream errors: ${!serverTest.errors.changeStream ? '✅' : '❌'}`);
  console.log(`No port conflicts: ${!serverTest.errors.portConflict ? '✅' : '❌'}`);
  console.log(`Overall success: ${serverTest.success ? '✅' : '❌'}`);

  if (!serverTest.success) {
    console.log('\n❌ Issues detected:');
    if (serverTest.errors.changeStream) {
      console.log('- Change Stream errors still occurring');
    }
    if (serverTest.errors.portConflict) {
      console.log('- Port conflicts detected');
    }
    if (!serverTest.errors.serverStarted) {
      console.log('- Server failed to start');
    }

    console.log('\n📝 Server output:');
    console.log(serverTest.output);
  } else {
    console.log('\n🎉 All fixes working correctly!');
    console.log('- MongoDB Change Stream errors resolved');
    console.log('- Port conflicts resolved');
    console.log('- Server starts successfully');
  }
}

runTests().catch(console.error);