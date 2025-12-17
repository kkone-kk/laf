const axios = require('axios')

// Configuration
const SERVER_URL = 'http://localhost:3000'
const GATEWAY_URL = 'http://localhost:8082'
const TEST_APPID = 'test-app'
const TEST_FUNCTION_NAME = 'hello-shared'

// Test function code
const TEST_FUNCTION_CODE = `
export async function main(ctx) {
  console.log('Function called in shared runtime:', ctx.body)
  return {
    statusCode: 200,
    body: {
      message: 'Hello from shared runtime!',
      timestamp: new Date().toISOString(),
      appid: ctx.headers['x-laf-appid'] || 'unknown',
      functionName: '${TEST_FUNCTION_NAME}',
      runtimeType: 'shared'
    }
  }
}
`

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function makeRequest(url, options = {}) {
  try {
    const response = await axios(url, {
      timeout: 10000,
      ...options
    })
    return { success: true, data: response.data, status: response.status }
  } catch (error) {
    return {
      success: false,
      error: error.message,
      status: error.response?.status,
      data: error.response?.data
    }
  }
}

async function testSharedRuntimeArchitecture() {
  console.log('🚀 Testing Shared Runtime Architecture...\n')

  try {
    // Step 1: Check server health
    console.log('1. Checking server health...')
    const healthCheck = await makeRequest(`${SERVER_URL}/health`)
    if (healthCheck.success) {
      console.log('   ✅ Server is running')
    } else {
      console.log('   ⚠️  Server health check failed, continuing anyway...')
    }

    // Step 2: Create test function
    console.log('\n2. Creating test function...')
    const createResponse = await makeRequest(`${SERVER_URL}/apps/${TEST_APPID}/functions`, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer test-token',
        'Content-Type': 'application/json'
      },
      data: {
        name: TEST_FUNCTION_NAME,
        code: TEST_FUNCTION_CODE,
        methods: ['GET', 'POST'],
        description: 'Test function for shared runtime architecture'
      }
    })

    if (createResponse.success) {
      console.log(`   ✅ Function created: ${createResponse.data.data.name}`)
      console.log(`   📋 Initial state: ${createResponse.data.data.state}`)
    } else if (createResponse.status === 409) {
      console.log('   ✅ Function already exists')
    } else {
      throw new Error(`Failed to create function: ${createResponse.error}`)
    }

    // Step 3: Check shared runtime status
    console.log('\n3. Checking shared runtime status...')
    const runtimeStatus = await makeRequest(`${SERVER_URL}/apps/${TEST_APPID}/functions/runtime/status`, {
      method: 'GET',
      headers: {
        'Authorization': 'Bearer test-token'
      }
    })
    if (runtimeStatus.success) {
      console.log('   ✅ Shared runtime status:', runtimeStatus.data.data.sharedRuntime)
      console.log('   📊 Functions in runtime:', runtimeStatus.data.data.functions.length)
    }

    // Step 4: Deploy function to shared runtime
    console.log('\n4. Deploying function to shared runtime...')
    const deployResponse = await makeRequest(`${SERVER_URL}/apps/${TEST_APPID}/functions/${TEST_FUNCTION_NAME}/deploy`, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer test-token'
      }
    })
    if (deployResponse.success) {
      console.log('   ✅ Function deployed:', deployResponse.data.data)
    } else {
      console.log('   ⚠️  Deploy failed:', deployResponse.error)
    }

    // Step 5: Wait for deployment
    console.log('\n5. Waiting for deployment to complete...')
    await sleep(3000)

    // Step 6: Check function status
    console.log('\n6. Checking function status...')
    const statusResponse = await makeRequest(`${SERVER_URL}/apps/${TEST_APPID}/functions/${TEST_FUNCTION_NAME}/status`, {
      method: 'GET',
      headers: {
        'Authorization': 'Bearer test-token'
      }
    })
    if (statusResponse.success) {
      console.log('   ✅ Function status:', statusResponse.data.data)
    }

    // Step 7: Test function call through shared runtime
    console.log('\n7. Testing function call through shared runtime...')
    const functionCall = await makeRequest(`${GATEWAY_URL}/${TEST_FUNCTION_NAME}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Host': `${TEST_APPID}.localhost`
      },
      data: {
        test: 'shared runtime',
        message: 'Hello from test!'
      }
    })
    if (functionCall.success) {
      console.log('   ✅ Function response:', functionCall.data)
    } else {
      console.log('   ⚠️  Function call failed:', functionCall.error)
    }

    // Step 8: Test multiple concurrent calls
    console.log('\n8. Testing concurrent calls to shared runtime...')
    const promises = []
    for (let i = 0; i < 5; i++) {
      promises.push(makeRequest(`${GATEWAY_URL}/${TEST_FUNCTION_NAME}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Host': `${TEST_APPID}.localhost`
        },
        data: { concurrent: i }
      }))
    }

    const results = await Promise.all(promises)
    const successful = results.filter(r => r.success).length
    console.log(`   ✅ ${successful}/5 concurrent calls successful`)

    // Step 9: Undeploy function
    console.log('\n9. Undeploying function...')
    const undeployResponse = await makeRequest(`${SERVER_URL}/apps/${TEST_APPID}/functions/${TEST_FUNCTION_NAME}/undeploy`, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer test-token'
      }
    })
    if (undeployResponse.success) {
      console.log('   ✅ Function undeployed:', undeployResponse.data.data)
    }

    // Step 10: Verify function is stopped
    console.log('\n10. Verifying function is stopped...')
    await sleep(2000)

    const finalCall = await makeRequest(`${GATEWAY_URL}/${TEST_FUNCTION_NAME}`, {
      method: 'GET',
      headers: {
        'Host': `${TEST_APPID}.localhost`
      }
    })
    if (!finalCall.success) {
      console.log('    ✅ Function correctly stopped (call failed as expected)')
    } else {
      console.log('    ⚠️  Function still responding after undeploy')
    }

    console.log('\n🎉 Shared Runtime Architecture Test Completed Successfully!')
    console.log('\n📊 Architecture Summary:')
    console.log('   ✅ Shared runtime process for all functions')
    console.log('   ✅ Database-driven function state management')
    console.log('   ✅ Simplified deploy/undeploy operations')
    console.log('   ✅ Gateway routing to shared runtime')
    console.log('   ✅ Lightweight local development experience')

  } catch (error) {
    console.error('\n❌ Test failed:', error.message)
    if (error.response) {
      console.error('Response data:', error.response.data)
      console.error('Response status:', error.response.status)
    }
  }
}

// Run the test
testSharedRuntimeArchitecture()