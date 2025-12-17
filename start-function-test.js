const { spawn } = require('child_process')
const axios = require('axios')

const SERVER_URL = 'http://localhost:3000'
const GATEWAY_URL = 'http://localhost:8082'

async function checkService(url, name) {
  try {
    await axios.get(url, { timeout: 5000 })
    console.log(`✅ ${name} is running`)
    return true
  } catch (error) {
    console.log(`❌ ${name} is not running`)
    return false
  }
}

async function waitForService(url, name, maxAttempts = 30) {
  console.log(`⏳ Waiting for ${name} to start...`)

  for (let i = 0; i < maxAttempts; i++) {
    if (await checkService(url, name)) {
      return true
    }
    await new Promise(resolve => setTimeout(resolve, 2000))
  }

  console.log(`❌ ${name} failed to start within ${maxAttempts * 2} seconds`)
  return false
}

async function main() {
  console.log('🚀 Starting Function Architecture Test Environment...\n')

  // Check if services are already running
  console.log('1. Checking existing services...')
  const serverRunning = await checkService(SERVER_URL, 'Server')
  const gatewayRunning = await checkService(GATEWAY_URL, 'Gateway')

  if (serverRunning && gatewayRunning) {
    console.log('\n✅ All services are already running!')
    console.log('\n🧪 Running comprehensive test...')

    // Run the test
    const testProcess = spawn('node', ['comprehensive-function-test.js'], {
      stdio: 'inherit'
    })

    testProcess.on('close', (code) => {
      console.log(`\n🏁 Test completed with exit code ${code}`)
    })

    return
  }

  console.log('\n2. Starting services...')

  if (!serverRunning) {
    console.log('   Starting server...')
    const serverProcess = spawn('npm', ['run', 'start:dev'], {
      cwd: 'server',
      stdio: 'pipe'
    })

    serverProcess.stdout.on('data', (data) => {
      const output = data.toString()
      if (output.includes('Application is running')) {
        console.log('   ✅ Server started successfully')
      }
    })

    serverProcess.stderr.on('data', (data) => {
      console.error('Server error:', data.toString())
    })

    // Wait for server to start
    if (!(await waitForService(SERVER_URL, 'Server'))) {
      console.log('❌ Failed to start server')
      return
    }
  }

  if (!gatewayRunning) {
    console.log('   Gateway should start automatically with the server...')

    // Wait for gateway to start
    if (!(await waitForService(GATEWAY_URL, 'Gateway'))) {
      console.log('❌ Failed to start gateway')
      return
    }
  }

  console.log('\n✅ All services are running!')
  console.log('\n🧪 Running comprehensive test...')

  // Run the test
  const testProcess = spawn('node', ['comprehensive-function-test.js'], {
    stdio: 'inherit'
  })

  testProcess.on('close', (code) => {
    console.log(`\n🏁 Test completed with exit code ${code}`)

    if (code === 0) {
      console.log('\n🎉 Function architecture optimization completed successfully!')
      console.log('\n📋 What was optimized:')
      console.log('   • Changed from app-level to function-level process management')
      console.log('   • Added individual function runtime control (start/stop/restart)')
      console.log('   • Implemented function-specific routing in gateway')
      console.log('   • Added comprehensive runtime status monitoring')
      console.log('   • Improved process isolation and resource management')
      console.log('\n🔧 New API endpoints available:')
      console.log('   • POST /apps/{appid}/functions/{name}/runtime/start')
      console.log('   • POST /apps/{appid}/functions/{name}/runtime/stop')
      console.log('   • POST /apps/{appid}/functions/{name}/runtime/restart')
      console.log('   • GET  /apps/{appid}/functions/{name}/runtime/status')
      console.log('   • GET  /apps/{appid}/functions/runtime/status')
      console.log('\n🌐 Gateway routing patterns:')
      console.log('   • /{functionName} - Direct function access')
      console.log('   • /functions/{functionName} - Prefixed function access')
    }
  })
}

main().catch(console.error)