#!/usr/bin/env node

/**
 * Test script to verify the optimized application lifecycle management
 * Tests the coordination between ApplicationTaskService and InstanceTaskService
 */

const { MongoClient } = require('mongodb')
const axios = require('axios')

const MONGO_URL = process.env.DATABASE_URL || 'mongodb://root:123456@localhost:27017/laf-server?authSource=admin'
const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3000'

class LifecycleTest {
  constructor() {
    this.client = null
    this.db = null
  }

  async connect() {
    console.log('Connecting to MongoDB...')
    this.client = new MongoClient(MONGO_URL)
    await this.client.connect()
    this.db = this.client.db()
    console.log('Connected to MongoDB')
  }

  async disconnect() {
    if (this.client) {
      await this.client.close()
      console.log('Disconnected from MongoDB')
    }
  }

  async findTestApp() {
    const apps = await this.db.collection('Application').find({}).limit(5).toArray()
    if (apps.length === 0) {
      console.log('No applications found in database')
      return null
    }

    console.log(`Found ${apps.length} applications:`)
    apps.forEach((app, index) => {
      console.log(`  ${index + 1}. ${app.appid} - Phase: ${app.phase}, State: ${app.state}`)
    })

    return apps[0]
  }

  async testApplicationLifecycle() {
    console.log('\n=== Testing Application Lifecycle Management ===')

    const app = await this.findTestApp()
    if (!app) {
      console.log('No test application available')
      return
    }

    const appid = app.appid
    console.log(`\nTesting with application: ${appid}`)
    console.log(`Initial state - Phase: ${app.phase}, State: ${app.state}`)

    // Test 1: Check if application can transition from Created to Starting
    if (app.phase === 'Created') {
      console.log('\n--- Test 1: Created -> Starting transition ---')
      console.log('Application is in Created phase, waiting for ApplicationTaskService to handle it...')

      await this.waitForPhaseChange(appid, 'Created', 30000)
      const updatedApp = await this.db.collection('Application').findOne({ appid })
      console.log(`After transition - Phase: ${updatedApp.phase}, State: ${updatedApp.state}`)
    }

    // Test 2: Check if application can transition from Starting to Started
    const currentApp = await this.db.collection('Application').findOne({ appid })
    if (currentApp.phase === 'Starting') {
      console.log('\n--- Test 2: Starting -> Started transition ---')
      console.log('Application is in Starting phase, waiting for InstanceTaskService to handle it...')

      await this.waitForPhaseChange(appid, 'Starting', 60000)
      const updatedApp = await this.db.collection('Application').findOne({ appid })
      console.log(`After transition - Phase: ${updatedApp.phase}, State: ${updatedApp.state}`)
    }

    // Test 3: Test state change to Stopped
    const runningApp = await this.db.collection('Application').findOne({ appid })
    if (runningApp.state === 'Running' && runningApp.phase === 'Started') {
      console.log('\n--- Test 3: Running -> Stopped state change ---')

      await this.db.collection('Application').updateOne(
        { appid },
        { $set: { state: 'Stopped', updatedAt: new Date() } }
      )
      console.log('Changed application state to Stopped')

      await this.waitForPhaseChange(appid, 'Started', 30000)
      const stoppedApp = await this.db.collection('Application').findOne({ appid })
      console.log(`After stopping - Phase: ${stoppedApp.phase}, State: ${stoppedApp.state}`)
    }

    // Test 4: Test state change back to Running
    const stoppedApp = await this.db.collection('Application').findOne({ appid })
    if (stoppedApp.state === 'Stopped' && stoppedApp.phase === 'Stopped') {
      console.log('\n--- Test 4: Stopped -> Running state change ---')

      await this.db.collection('Application').updateOne(
        { appid },
        { $set: { state: 'Running', updatedAt: new Date() } }
      )
      console.log('Changed application state to Running')

      await this.waitForPhaseChange(appid, 'Stopped', 60000)
      const restartedApp = await this.db.collection('Application').findOne({ appid })
      console.log(`After restarting - Phase: ${restartedApp.phase}, State: ${restartedApp.state}`)
    }
  }

  async waitForPhaseChange(appid, currentPhase, timeout = 30000) {
    const startTime = Date.now()

    while (Date.now() - startTime < timeout) {
      const app = await this.db.collection('Application').findOne({ appid })
      if (app.phase !== currentPhase) {
        console.log(`Phase changed from ${currentPhase} to ${app.phase}`)
        return app
      }

      console.log(`Waiting for phase change... Current: ${app.phase}, State: ${app.state}`)
      await new Promise(resolve => setTimeout(resolve, 2000))
    }

    console.log(`Timeout waiting for phase change from ${currentPhase}`)
    return null
  }

  async checkForLoops() {
    console.log('\n=== Checking for Application Loops ===')

    const apps = await this.db.collection('Application').find({
      $or: [
        { phase: 'Starting' },
        { phase: 'Stopping' }
      ]
    }).toArray()

    if (apps.length === 0) {
      console.log('No applications in transitional phases')
      return
    }

    console.log(`Found ${apps.length} applications in transitional phases:`)

    for (const app of apps) {
      const timeSinceUpdate = Date.now() - app.updatedAt.getTime()
      const minutesSinceUpdate = Math.floor(timeSinceUpdate / 60000)

      console.log(`  ${app.appid}: Phase=${app.phase}, State=${app.state}, LastUpdate=${minutesSinceUpdate}min ago`)

      if (minutesSinceUpdate > 5) {
        console.log(`    ⚠️  WARNING: Application stuck in ${app.phase} phase for ${minutesSinceUpdate} minutes`)
      }
    }
  }

  async testSharedRuntimeIntegration() {
    console.log('\n=== Testing Shared Runtime Integration ===')

    try {
      // Check if shared runtime is accessible
      const response = await axios.get(`${SERVER_URL}/health`, { timeout: 5000 })
      console.log('✅ Server is accessible')

      // Check function runtime endpoint
      try {
        const runtimeResponse = await axios.get(`${SERVER_URL}/v1/apps`, {
          timeout: 5000,
          validateStatus: () => true // Accept any status code
        })
        console.log(`✅ Runtime endpoint accessible (status: ${runtimeResponse.status})`)
      } catch (error) {
        console.log('⚠️  Runtime endpoint not accessible:', error.message)
      }

    } catch (error) {
      console.log('❌ Server not accessible:', error.message)
    }
  }

  async run() {
    try {
      await this.connect()

      await this.checkForLoops()
      await this.testSharedRuntimeIntegration()
      await this.testApplicationLifecycle()

      console.log('\n=== Test Summary ===')
      console.log('✅ Lifecycle optimization test completed')
      console.log('📋 Check the logs above for any warnings or issues')

    } catch (error) {
      console.error('❌ Test failed:', error)
    } finally {
      await this.disconnect()
    }
  }
}

// Run the test
if (require.main === module) {
  const test = new LifecycleTest()
  test.run().catch(console.error)
}

module.exports = LifecycleTest