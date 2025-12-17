#!/usr/bin/env node

/**
 * Comprehensive test for the optimized shared runtime architecture
 * Tests all components working together
 */

const { MongoClient } = require('mongodb')
const axios = require('axios')

const MONGO_URL = process.env.DATABASE_URL || 'mongodb://admin:123456@localhost:27017/laf?authSource=admin'
const SERVER_URL = process.env.API_SERVER_URL || 'http://localhost:3002'

class ComprehensiveTest {
  constructor() {
    this.client = null
    this.db = null
  }

  async connect() {
    console.log('🔌 Connecting to MongoDB...')
    this.client = new MongoClient(MONGO_URL)
    await this.client.connect()
    this.db = this.client.db()
    console.log('✅ Connected to MongoDB')
  }

  async disconnect() {
    if (this.client) {
      await this.client.close()
      console.log('🔌 Disconnected from MongoDB')
    }
  }

  async testDatabaseConnection() {
    console.log('\n📊 Testing Database Connection...')
    try {
      const collections = await this.db.listCollections().toArray()
      console.log(`✅ Database accessible, found ${collections.length} collections`)

      const appCount = await this.db.collection('Application').countDocuments()
      console.log(`📱 Found ${appCount} applications in database`)

      return true
    } catch (error) {
      console.log('❌ Database connection failed:', error.message)
      return false
    }
  }

  async testServerHealth() {
    console.log('\n🏥 Testing Server Health...')
    try {
      const response = await axios.get(`${SERVER_URL}/health`, { timeout: 5000 })
      console.log('✅ Server health check passed')
      return true
    } catch (error) {
      console.log('❌ Server health check failed:', error.message)
      return false
    }
  }

  async testApplicationLifecycle() {
    console.log('\n🔄 Testing Application Lifecycle...')

    // Check for stuck applications
    const stuckApps = await this.db.collection('Application').find({
      $or: [
        { phase: 'Starting' },
        { phase: 'Stopping' }
      ]
    }).toArray()

    if (stuckApps.length > 0) {
      console.log(`⚠️  Found ${stuckApps.length} applications in transitional phases:`)
      stuckApps.forEach(app => {
        const timeSinceUpdate = Date.now() - app.updatedAt.getTime()
        const minutesSinceUpdate = Math.floor(timeSinceUpdate / 60000)
        console.log(`   ${app.appid}: ${app.phase}/${app.state} (${minutesSinceUpdate}min ago)`)
      })
      return false
    } else {
      console.log('✅ No applications stuck in transitional phases')
      return true
    }
  }

  async testSharedRuntimeIntegration() {
    console.log('\n🚀 Testing Shared Runtime Integration...')

    // Get a running application
    const runningApp = await this.db.collection('Application').findOne({
      phase: 'Started',
      state: 'Running'
    })

    if (!runningApp) {
      console.log('⚠️  No running applications found to test')
      return true
    }

    console.log(`📱 Testing with application: ${runningApp.appid}`)

    try {
      // Test function runtime endpoint
      const runtimeUrl = `${SERVER_URL}/v1/apps/${runningApp.appid}/functions`
      const response = await axios.get(runtimeUrl, {
        timeout: 5000,
        validateStatus: () => true // Accept any status code
      })

      if (response.status === 200 || response.status === 404) {
        console.log('✅ Shared runtime endpoint accessible')
        return true
      } else {
        console.log(`⚠️  Unexpected response status: ${response.status}`)
        return false
      }
    } catch (error) {
      console.log('❌ Shared runtime endpoint test failed:', error.message)
      return false
    }
  }

  async testMinIOIntegration() {
    console.log('\n🗄️  Testing MinIO Integration...')

    try {
      // Test MinIO health
      const response = await axios.get('http://localhost:9000/minio/health/live', {
        timeout: 5000,
        validateStatus: () => true
      })

      if (response.status === 200) {
        console.log('✅ MinIO is accessible')
        return true
      } else {
        console.log(`⚠️  MinIO health check returned status: ${response.status}`)
        return false
      }
    } catch (error) {
      console.log('❌ MinIO health check failed:', error.message)
      return false
    }
  }

  async generateReport() {
    console.log('\n📊 System Status Report')
    console.log('='.repeat(50))

    // Application distribution
    const pipeline = [
      {
        $group: {
          _id: { phase: '$phase', state: '$state' },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.phase': 1, '_id.state': 1 } }
    ]

    const distribution = await this.db.collection('Application').aggregate(pipeline).toArray()

    console.log('\n📱 Application Distribution:')
    distribution.forEach(item => {
      const { phase, state } = item._id
      console.log(`   ${phase || 'null'}/${state || 'null'}: ${item.count} apps`)
    })

    // Recent activity
    const recentApps = await this.db.collection('Application')
      .find({})
      .sort({ updatedAt: -1 })
      .limit(5)
      .toArray()

    console.log('\n🕒 Recent Activity:')
    recentApps.forEach(app => {
      const timeSinceUpdate = Date.now() - app.updatedAt.getTime()
      const minutesAgo = Math.floor(timeSinceUpdate / 60000)
      console.log(`   ${app.appid}: ${app.phase}/${app.state} (${minutesAgo}min ago)`)
    })
  }

  async run() {
    console.log('🧪 Starting Comprehensive System Test')
    console.log('='.repeat(50))

    const results = {
      database: false,
      server: false,
      lifecycle: false,
      runtime: false,
      minio: false
    }

    try {
      await this.connect()

      results.database = await this.testDatabaseConnection()
      results.server = await this.testServerHealth()
      results.lifecycle = await this.testApplicationLifecycle()
      results.runtime = await this.testSharedRuntimeIntegration()
      results.minio = await this.testMinIOIntegration()

      await this.generateReport()

      console.log('\n🎯 Test Results Summary')
      console.log('='.repeat(50))

      const passed = Object.values(results).filter(Boolean).length
      const total = Object.keys(results).length

      Object.entries(results).forEach(([test, passed]) => {
        const status = passed ? '✅' : '❌'
        console.log(`${status} ${test.charAt(0).toUpperCase() + test.slice(1)} Test`)
      })

      console.log(`\n📈 Overall Score: ${passed}/${total} tests passed`)

      if (passed === total) {
        console.log('🎉 All tests passed! System is working correctly.')
      } else {
        console.log('⚠️  Some tests failed. Please check the logs above.')
      }

    } catch (error) {
      console.error('❌ Test suite failed:', error)
    } finally {
      await this.disconnect()
    }
  }
}

// Run the comprehensive test
if (require.main === module) {
  const test = new ComprehensiveTest()
  test.run().catch(console.error)
}

module.exports = ComprehensiveTest