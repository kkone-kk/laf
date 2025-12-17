#!/usr/bin/env node

const http = require('http')
const { performance } = require('perf_hooks')

// Configuration
const SERVER_URL = 'http://localhost:3002'
const SHARED_RUNTIME_URL = 'http://localhost:8000'

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

function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const startTime = performance.now()

    const req = http.request(url, options, (res) => {
      let data = ''

      res.on('data', (chunk) => {
        data += chunk
      })

      res.on('end', () => {
        const endTime = performance.now()
        const responseTime = endTime - startTime

        try {
          const parsedData = data ? JSON.parse(data) : null
          resolve({
            statusCode: res.statusCode,
            data: parsedData,
            responseTime: Math.round(responseTime),
            headers: res.headers
          })
        } catch (error) {
          resolve({
            statusCode: res.statusCode,
            data: data,
            responseTime: Math.round(responseTime),
            headers: res.headers
          })
        }
      })
    })

    req.on('error', (error) => {
      reject(error)
    })

    req.setTimeout(10000, () => {
      req.destroy()
      reject(new Error('Request timeout'))
    })

    if (options.body) {
      req.write(options.body)
    }

    req.end()
  })
}

async function testSystemHealth() {
  log('\n=== Testing System Health ===', colors.bold + colors.blue)

  try {
    const response = await makeRequest(`${SERVER_URL}/system/health`)

    if (response.statusCode === 200) {
      log(`✅ System health check passed (${response.responseTime}ms)`, colors.green)
      log(`   Status: ${response.data.status}`)
      log(`   Memory: ${Math.round(response.data.metrics.memoryUsage.heapUsed / 1024 / 1024)}MB`)
      log(`   Uptime: ${Math.round(response.data.metrics.uptime)}s`)

      if (response.data.issues && response.data.issues.length > 0) {
        log(`   Issues: ${response.data.issues.join(', ')}`, colors.yellow)
      }
    } else {
      log(`❌ System health check failed (${response.statusCode})`, colors.red)
    }
  } catch (error) {
    log(`❌ System health check error: ${error.message}`, colors.red)
  }
}

async function testRuntimeHealth() {
  log('\n=== Testing Runtime Health ===', colors.bold + colors.blue)

  try {
    const response = await makeRequest(`${SERVER_URL}/system/runtime/health`)

    if (response.statusCode === 200) {
      log(`✅ Runtime health check passed (${response.responseTime}ms)`, colors.green)
      log(`   Healthy: ${response.data.isHealthy}`)

      if (response.data.responseTime) {
        log(`   Runtime response time: ${response.data.responseTime}ms`)
      }

      if (response.data.error) {
        log(`   Error: ${response.data.error}`, colors.yellow)
      }
    } else {
      log(`❌ Runtime health check failed (${response.statusCode})`, colors.red)
    }
  } catch (error) {
    log(`❌ Runtime health check error: ${error.message}`, colors.red)
  }
}

async function testRuntimeInfo() {
  log('\n=== Testing Runtime Info ===', colors.bold + colors.blue)

  try {
    const response = await makeRequest(`${SERVER_URL}/system/runtime/info`)

    if (response.statusCode === 200 && response.data) {
      log(`✅ Runtime info retrieved (${response.responseTime}ms)`, colors.green)
      log(`   PID: ${response.data.pid}`)
      log(`   Port: ${response.data.port}`)
      log(`   Status: ${response.data.status}`)
      log(`   Start time: ${response.data.startTime}`)

      if (response.data.restartCount) {
        log(`   Restart count: ${response.data.restartCount}`)
      }
    } else {
      log(`❌ Runtime info failed (${response.statusCode})`, colors.red)
    }
  } catch (error) {
    log(`❌ Runtime info error: ${error.message}`, colors.red)
  }
}

async function testPerformanceMetrics() {
  log('\n=== Testing Performance Metrics ===', colors.bold + colors.blue)

  try {
    const response = await makeRequest(`${SERVER_URL}/system/performance/metrics`)

    if (response.statusCode === 200) {
      log(`✅ Performance metrics retrieved (${response.responseTime}ms)`, colors.green)

      if (response.data.history && response.data.history.length > 0) {
        const latest = response.data.history[response.data.history.length - 1]
        log(`   Latest metrics from: ${latest.timestamp}`)
        log(`   Memory: ${Math.round(latest.memoryUsage.heapUsed / 1024 / 1024)}MB`)
        log(`   History entries: ${response.data.history.length}`)
      }

      if (response.data.loggerMetrics) {
        const loggerKeys = Object.keys(response.data.loggerMetrics)
        if (loggerKeys.length > 0) {
          log(`   Logger metrics: ${loggerKeys.length} operations tracked`)
        }
      }
    } else {
      log(`❌ Performance metrics failed (${response.statusCode})`, colors.red)
    }
  } catch (error) {
    log(`❌ Performance metrics error: ${error.message}`, colors.red)
  }
}

async function testSystemStatus() {
  log('\n=== Testing System Status ===', colors.bold + colors.blue)

  try {
    const response = await makeRequest(`${SERVER_URL}/system/status`)

    if (response.statusCode === 200) {
      log(`✅ System status retrieved (${response.responseTime}ms)`, colors.green)
      log(`   Timestamp: ${response.data.timestamp}`)
      log(`   System status: ${response.data.system.status}`)
      log(`   Runtime healthy: ${response.data.runtime.health.isHealthy}`)

      if (response.data.performance.metrics.length > 0) {
        log(`   Performance history: ${response.data.performance.metrics.length} entries`)
      }
    } else {
      log(`❌ System status failed (${response.statusCode})`, colors.red)
    }
  } catch (error) {
    log(`❌ System status error: ${error.message}`, colors.red)
  }
}

async function testSharedRuntimeDirect() {
  log('\n=== Testing Shared Runtime Direct ===', colors.bold + colors.blue)

  try {
    const response = await makeRequest(`${SHARED_RUNTIME_URL}/health`)

    if (response.statusCode === 200) {
      log(`✅ Shared runtime direct health check passed (${response.responseTime}ms)`, colors.green)
    } else {
      log(`❌ Shared runtime direct health check failed (${response.statusCode})`, colors.red)
    }
  } catch (error) {
    log(`❌ Shared runtime direct health check error: ${error.message}`, colors.red)
    log(`   This is expected if the shared runtime is not running`, colors.yellow)
  }
}

async function performanceStressTest() {
  log('\n=== Performance Stress Test ===', colors.bold + colors.blue)

  const requests = 10
  const concurrent = 3

  log(`Running ${requests} requests with ${concurrent} concurrent connections...`)

  const startTime = performance.now()
  const promises = []

  for (let i = 0; i < requests; i++) {
    const promise = makeRequest(`${SERVER_URL}/system/health`)
      .then(response => ({
        success: response.statusCode === 200,
        responseTime: response.responseTime
      }))
      .catch(error => ({
        success: false,
        error: error.message
      }))

    promises.push(promise)

    // Limit concurrent requests
    if (promises.length >= concurrent) {
      await Promise.all(promises.splice(0, concurrent))
    }
  }

  // Wait for remaining requests
  if (promises.length > 0) {
    await Promise.all(promises)
  }

  const endTime = performance.now()
  const totalTime = Math.round(endTime - startTime)

  log(`✅ Stress test completed in ${totalTime}ms`, colors.green)
  log(`   Average time per request: ${Math.round(totalTime / requests)}ms`)
}

async function runAllTests() {
  log('🚀 Starting Performance Optimization Tests', colors.bold + colors.green)
  log('='.repeat(50))

  await testSystemHealth()
  await testRuntimeHealth()
  await testRuntimeInfo()
  await testPerformanceMetrics()
  await testSystemStatus()
  await testSharedRuntimeDirect()
  await performanceStressTest()

  log('\n' + '='.repeat(50))
  log('✅ All performance optimization tests completed!', colors.bold + colors.green)
  log('\nNext steps:')
  log('1. Check the server logs for any performance warnings')
  log('2. Monitor the system metrics over time')
  log('3. Adjust configuration based on your workload')
  log('4. Set up alerts for critical thresholds')
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
runAllTests().catch(error => {
  log(`❌ Test suite failed: ${error.message}`, colors.red)
  process.exit(1)
})