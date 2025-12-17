#!/usr/bin/env node

const { spawn } = require('child_process');

console.log('🔧 Testing Configuration and Fixes');
console.log('==================================');

// Test server startup with detailed logging
async function testServerStartup() {
  return new Promise((resolve) => {
    console.log('\n📡 Testing server startup...');

    const server = spawn('npm', ['run', 'dev'], {
      cwd: './server',
      stdio: 'pipe',
      shell: true
    });

    let output = '';
    let serverStarted = false;
    let changeStreamHandled = false;
    let singleRuntimeInstance = true;
    let noPortConflicts = true;
    let runtimeStartCount = 0;

    const timeout = setTimeout(() => {
      server.kill();
      resolve({
        success: serverStarted && changeStreamHandled && singleRuntimeInstance && noPortConflicts,
        results: {
          serverStarted,
          changeStreamHandled,
          singleRuntimeInstance,
          noPortConflicts,
          runtimeStartCount
        },
        output: output
      });
    }, 15000);

    server.stdout.on('data', (data) => {
      const text = data.toString();
      output += text;

      if (text.includes('Nest application successfully started')) {
        serverStarted = true;
        console.log('✅ Server started successfully');
      }

      if (text.includes('Shared runtime started on port')) {
        runtimeStartCount++;
        console.log(`✅ Shared runtime started (count: ${runtimeStartCount})`);
      }

      if (text.includes('Change streams not supported') &&
        text.includes('MongoDB is not running as a replica set')) {
        changeStreamHandled = true;
        console.log('✅ Change streams handled gracefully');
      }

      if (text.includes('Storage server') && text.includes('listened on')) {
        console.log('✅ Storage server started');
      }
    });

    server.stderr.on('data', (data) => {
      const text = data.toString();
      output += text;

      if (text.includes('EADDRINUSE')) {
        noPortConflicts = false;
        console.log('❌ Port conflict detected');
      }
    });

    server.on('close', () => {
      clearTimeout(timeout);

      // Check if only one runtime instance was started
      if (runtimeStartCount > 1) {
        singleRuntimeInstance = false;
      }

      resolve({
        success: serverStarted && changeStreamHandled && singleRuntimeInstance && noPortConflicts,
        results: {
          serverStarted,
          changeStreamHandled,
          singleRuntimeInstance,
          noPortConflicts,
          runtimeStartCount
        },
        output: output
      });
    });
  });
}

async function runTests() {
  const serverTest = await testServerStartup();

  console.log('\n📊 Final Test Results:');
  console.log('======================');
  console.log(`✅ Server started: ${serverTest.results.serverStarted ? 'YES' : 'NO'}`);
  console.log(`✅ Change streams handled: ${serverTest.results.changeStreamHandled ? 'YES' : 'NO'}`);
  console.log(`✅ Single runtime instance: ${serverTest.results.singleRuntimeInstance ? 'YES' : 'NO'} (count: ${serverTest.results.runtimeStartCount})`);
  console.log(`✅ No port conflicts: ${serverTest.results.noPortConflicts ? 'YES' : 'NO'}`);
  console.log(`🎯 Overall success: ${serverTest.success ? 'YES' : 'NO'}`);

  if (serverTest.success) {
    console.log('\n🎉 ALL FIXES WORKING CORRECTLY!');
    console.log('================================');
    console.log('✅ MongoDB Change Stream errors resolved');
    console.log('✅ Port conflicts resolved');
    console.log('✅ Multiple runtime instances prevented');
    console.log('✅ Server starts successfully');
    console.log('✅ Graceful error handling implemented');
  } else {
    console.log('\n❌ Some issues remain:');
    if (!serverTest.results.serverStarted) console.log('- Server failed to start');
    if (!serverTest.results.changeStreamHandled) console.log('- Change streams not handled properly');
    if (!serverTest.results.singleRuntimeInstance) console.log('- Multiple runtime instances detected');
    if (!serverTest.results.noPortConflicts) console.log('- Port conflicts detected');
  }
}

runTests().catch(console.error);