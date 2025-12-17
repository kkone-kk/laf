#!/usr/bin/env node

const { spawn } = require('child_process')
const http = require('http')
const path = require('path')

// Colors for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
}

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`)
}

function waitForServer(url, timeout = 30000) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now()

    function check() {
      const req = http.get(url, (res) => {
        if (res.statusCode === 200 || res.statusCode === 404) {
          resolve(true)
        } else {
          setTimeout(check, 1000)
        }
      })

      req.on('error', () => {
        if (Date.now() - startTime > timeout) {
          reject(new Error('Server startup timeout'))
        } else {
          setTimeout(check, 1000)
        }
      })

      req.setTimeout(5000, () => {
        req.destroy()
        if (Date.now() - startTime > timeout) {
          reject(new Error('Server startup timeout'))
        } else {
          setTimeout(check, 1000)
        }
      })
    }

    check()
  })
}

async function startServer() {
  log('🚀 Starting optimized server...', colors.bold + colors.blue)

  const serverProcess = spawn('npm', ['run', 'start:dev'], {
    cwd: path.join(__dirname, 'server'),
    stdio: 'pipe',
    shell: true
  })

  let serverOutput = ''

  serverProcess.stdout.on('data', (data) => {
    const output = data.toString()
    serverOutput += output

    // Show important server messages
    if (output.includes('Nest application successfully started') ||
      output.includes('Application is running on') ||
      output.includes('ERROR') ||
      output.includes('WARN')) {
      log(`Server: ${output.trim()}`, colors.yellow)
    }
  })

  serverProcess.stderr.on('data', (data) => {
    const output = data.toString()
    if (!output.includes('ExperimentalWarning')) {
      log(`Server Error: ${output.trim()}`, colors.red)
    }
  })

  // Wait for server to start
  try {
    log('⏳ Waiting for server to start...', colors.yellow)
    await waitForServer('http://localhost:3002')
    log('✅ Server is running!', colors.green)
    return serverProcess
  } catch (error) {
    log(`❌ Failed to start server: ${error.message}`, colors.red)
    serverProcess.kill()
    throw error
  }
}

async function runOptimizationTests() {
  log('\n📊 Running optimization tests...', colors.bold + colors.blue)

  const testProcess = spawn('node', ['test-performance-optimization.js'], {
    stdio: 'inherit',
    shell: true
  })

  return new Promise((resolve, reject) => {
    testProcess.on('exit', (code) => {
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`Tests failed with exit code ${code}`))
      }
    })

    testProcess.on('error', (error) => {
      reject(error)
    })
  })
}

async function main() {
  let serverProcess = null

  try {
    log('🔧 Testing System Optimizations', colors.bold + colors.green)
    log('='.repeat(50))

    // Start the server
    serverProcess = await startServer()

    // Wait a bit for full initialization
    await new Promise(resolve => setTimeout(resolve, 5000))

    // Run optimization tests
    await runOptimizationTests()

    log('\n' + '='.repeat(50))
    log('✅ All optimization tests completed successfully!', colors.bold + colors.green)

  } catch (error) {
    log(`❌ Test failed: ${error.message}`, colors.red)
    process.exit(1)
  } finally {
    if (serverProcess) {
      log('\n🛑 Stopping server...', colors.yellow)
      serverProcess.kill()

      // Wait for graceful shutdown
      await new Promise(resolve => setTimeout(resolve, 2000))
    }
  }
}

// Handle process termination
process.on('SIGINT', () => {
  log('\n\n⚠️  Test interrupted by user', colors.yellow)
  process.exit(0)
})

process.on('unhandledRejection', (reason, promise) => {
  log(`❌ Unhandled rejection: ${reason}`, colors.red)
  process.exit(1)
})

// Run the tests
main().catch(error => {
  log(`❌ Test suite failed: ${error.message}`, colors.red)
  process.exit(1)
})