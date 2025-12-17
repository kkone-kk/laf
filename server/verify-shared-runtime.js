const axios = require('axios');

async function verifySharedRuntime() {
  console.log('🔍 Verifying Shared Runtime');
  console.log('='.repeat(30));

  const runtimeUrl = 'http://localhost:8000';

  try {
    // Test health endpoint
    console.log('🏥 Testing health endpoint...');
    const healthResponse = await axios.get(`${runtimeUrl}/_/healthz`, { timeout: 3000 });
    console.log(`✅ Health check: ${healthResponse.status} - ${healthResponse.data}`);

    // Test API docs endpoint
    console.log('\n📚 Testing API docs endpoint...');
    try {
      const apiDocsResponse = await axios.get(`${runtimeUrl}/_/api-docs`, {
        timeout: 3000,
        validateStatus: () => true
      });
      console.log(`✅ API docs: ${apiDocsResponse.status}`);
    } catch (e) {
      console.log(`⚠️  API docs: ${e.message}`);
    }

    // Test function invocation endpoint (should return 404 for non-existent function)
    console.log('\n⚡ Testing function invocation...');
    try {
      const invokeResponse = await axios.post(`${runtimeUrl}/test-function`, {}, {
        timeout: 3000,
        validateStatus: () => true
      });
      console.log(`✅ Function invocation endpoint: ${invokeResponse.status}`);
    } catch (e) {
      console.log(`⚠️  Function invocation: ${e.message}`);
    }

    console.log('\n🎉 Shared runtime is running and accessible!');
    console.log('📋 Available endpoints:');
    console.log('   - Health: /_/healthz');
    console.log('   - API Docs: /_/api-docs');
    console.log('   - Functions: /{function-name}');
    console.log('   - Database Proxy: /proxy/{policy}');

  } catch (error) {
    console.log(`❌ Shared runtime verification failed: ${error.message}`);

    if (error.code === 'ECONNREFUSED') {
      console.log('\n💡 Troubleshooting:');
      console.log('   1. Check if the shared runtime process is running');
      console.log('   2. Verify the port configuration (default: 8000)');
      console.log('   3. Check server logs for startup errors');
    }
  }
}

verifySharedRuntime();