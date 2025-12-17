const { MongoClient } = require('mongodb');
const axios = require('axios');

async function checkRuntimeStatus() {
  console.log('🔍 Checking Runtime Status');
  console.log('='.repeat(40));

  const mongoUrl = 'mongodb://admin:123456@localhost:27017/laf?authSource=admin';

  try {
    // Check database connection
    const client = new MongoClient(mongoUrl);
    await client.connect();
    const db = client.db();

    console.log('✅ Database connected');

    // Check applications
    const apps = await db.collection('Application').find({
      phase: 'Started',
      state: 'Running'
    }).toArray();

    console.log(`📱 Found ${apps.length} running applications`);

    if (apps.length > 0) {
      const testApp = apps[0];
      console.log(`🧪 Testing with app: ${testApp.appid}`);

      // Check functions for this app
      const functions = await db.collection('CloudFunction').find({
        appid: testApp.appid
      }).toArray();

      console.log(`⚡ Found ${functions.length} functions in app ${testApp.appid}`);

      if (functions.length > 0) {
        functions.forEach((func, index) => {
          console.log(`   ${index + 1}. ${func.name} - State: ${func.state || 'undefined'}`);
        });
      }
    }

    await client.close();

    // Check if server is running
    console.log('\n🌐 Checking Server Status...');
    try {
      const response = await axios.get('http://localhost:3002/runtimes', { timeout: 3000 });
      console.log('✅ Server is running');
    } catch (error) {
      console.log('❌ Server is not accessible:', error.message);
    }

    // Check shared runtime port
    console.log('\n🚀 Checking Shared Runtime...');
    try {
      // Try to access the shared runtime port (usually 8000)
      const runtimeResponse = await axios.get('http://localhost:8000/health', {
        timeout: 3000,
        validateStatus: () => true
      });
      console.log(`✅ Shared runtime accessible (status: ${runtimeResponse.status})`);
    } catch (error) {
      console.log('⚠️  Shared runtime not accessible on port 8000:', error.message);

      // Try other common ports
      const ports = [8001, 8080, 3000, 3001];
      for (const port of ports) {
        try {
          const response = await axios.get(`http://localhost:${port}/health`, {
            timeout: 1000,
            validateStatus: () => true
          });
          console.log(`✅ Found service on port ${port} (status: ${response.status})`);
          break;
        } catch (e) {
          // Continue to next port
        }
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkRuntimeStatus();