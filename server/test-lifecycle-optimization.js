#!/usr/bin/env node

/**
 * Test script to verify the optimized application lifecycle management
 * Tests the coordination between ApplicationTaskService and InstanceTaskService
 */

const { MongoClient } = require('mongodb')

const MONGO_URL = process.env.DATABASE_URL || 'mongodb://admin:123456@localhost:27017/laf?authSource=admin'

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

  async checkForLoops() {
    console.log('\n=== Checking for Application Loops ===')

    const apps = await this.db.collection('Application').find({
      $or: [
        { phase: 'Starting' },
        { phase: 'Stopping' }
      ]
    }).toArray()

    if (apps.length === 0) {
      console.log('✅ No applications in transitional phases')
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

  async checkApplicationStates() {
    console.log('\n=== Application State Summary ===')

    const pipeline = [
      {
        $group: {
          _id: { phase: '$phase', state: '$state' },
          count: { $sum: 1 },
          apps: { $push: '$appid' }
        }
      },
      {
        $sort: { '_id.phase': 1, '_id.state': 1 }
      }
    ]

    const results = await this.db.collection('Application').aggregate(pipeline).toArray()

    if (results.length === 0) {
      console.log('No applications found')
      return
    }

    console.log('Application distribution by phase and state:')
    results.forEach(result => {
      const { phase, state } = result._id
      console.log(`  Phase: ${phase || 'null'}, State: ${state || 'null'} - ${result.count} apps`)
      if (result.count <= 3) {
        console.log(`    Apps: ${result.apps.join(', ')}`)
      }
    })
  }

  async testStateTransitions() {
    console.log('\n=== Testing State Transitions ===')

    const app = await this.findTestApp()
    if (!app) {
      console.log('No test application available')
      return
    }

    const appid = app.appid
    console.log(`\nTesting with application: ${appid}`)
    console.log(`Current state - Phase: ${app.phase}, State: ${app.state}`)

    // If app is in a stable state, test a transition
    if (app.phase === 'Started' && app.state === 'Running') {
      console.log('\n--- Testing Stop Transition ---')

      // Change state to Stopped
      await this.db.collection('Application').updateOne(
        { appid },
        {
          $set: {
            state: 'Stopped',
            updatedAt: new Date(),
            lockedAt: new Date(0) // Unlock for immediate processing
          }
        }
      )
      console.log('✅ Changed application state to Stopped')

      // Wait a bit and check the result
      await new Promise(resolve => setTimeout(resolve, 5000))

      const updatedApp = await this.db.collection('Application').findOne({ appid })
      console.log(`After 5 seconds - Phase: ${updatedApp.phase}, State: ${updatedApp.state}`)

      // Change back to Running
      console.log('\n--- Testing Start Transition ---')
      await this.db.collection('Application').updateOne(
        { appid },
        {
          $set: {
            state: 'Running',
            updatedAt: new Date(),
            lockedAt: new Date(0) // Unlock for immediate processing
          }
        }
      )
      console.log('✅ Changed application state back to Running')

      // Wait and check result
      await new Promise(resolve => setTimeout(resolve, 5000))

      const finalApp = await this.db.collection('Application').findOne({ appid })
      console.log(`After restart - Phase: ${finalApp.phase}, State: ${finalApp.state}`)
    }
  }

  async run() {
    try {
      await this.connect()

      await this.checkApplicationStates()
      await this.checkForLoops()
      await this.testStateTransitions()

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