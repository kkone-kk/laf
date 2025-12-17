const { MongoClient } = require('mongodb');
const axios = require('axios');

async function testSharedRuntime() {
  console.log('🚀 Testing Shared Runtime');
  console.log('='.repeat(30));

  // Test different ports where shared runtime might be running
  const ports = [8000, 8001, 8080, 3000, 3001];

  console.log('🔍 Checking for shared runtime on different ports...');

  for (const port of ports) {
    try {
      console.log(`   Testing port ${port}...`);
      const response = await axios.get(`http://localhost:${port}`, {
        timeout: 2000,
        validateStatus: () => true
      });
      console.log(`   ✅ Port ${port}: HTTP ${response.status}`);

      // Try to get more info
      try {
        const healthResponse = await axios.get(`http://localhost:${port}/health`, {
          timeout: 1000,
          validateStatus: () => true
        });
        console.log(`      /health: HTTP ${healthResponse.status}`);
      } catch (e) {
        console.log(`      /health: Not available`);
      }

    } catch (error) {
      console.log(`   ❌ Port ${port}: ${error.code || error.message}`);
    }
  }

  // Check if shared runtime process is running
  console.log('\n🔍 Checking for Node.js processes...');

  try {
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);

    // On Windows, use tasklist to find node processes
    const { stdout } = await execAsync('tasklist /FI "IMAGENAME eq node.exe" /FO CSV');
    const lines = stdout.split('\n').filter(line => line.includes('node.exe'));

    console.log(`   Found ${lines.length - 1} Node.js processes running`);

    if (lines.length > 1) {
      console.log('   Node.js processes:');
      lines.slice(1).forEach((line, index) => {
        const parts = line.split(',');
        if (parts.length >= 2) {
          const pid = parts[1].replace(/"/g, '');
          console.log(`     PID ${pid}`);
        }
      });
    }

  } catch (error) {
    console.log(`   ❌ Could not check processes: ${error.message}`);
  }

  // Check database for runtime info
  console.log('\n📊 Checking database for runtime configuration...');

  try {
    const mongoUrl = 'mongodb://admin:123456@localhost:27017/laf?authSource=admin';
    const client = new MongoClient(mongoUrl);
    await client.connect();
    const db = client.db();

    // Check if there are any runtime configurations
    const runtimes = await db.collection('Runtime').find({}).toArray();
    console.log(`   Found ${runtimes.length} runtime configurations`);

    runtimes.forEach((runtime, index) => {
      console.log(`     ${index + 1}. ${runtime.name}: ${runtime.image || 'No image'}`);
    });

    await client.close();

  } catch (error) {
    console.log(`   ❌ Database check failed: ${error.message}`);
  }

  console.log('\n💡 Recommendations:');
  console.log('   1. If no shared runtime is running, the server should start it automatically');
  console.log('   2. Check server logs for any startup errors');
  console.log('   3. Ensure the runtime is built: npm run build in runtimes/nodejs');
  console.log('   4. Try restarting the server to trigger shared runtime startup');
}

testSharedRuntime();