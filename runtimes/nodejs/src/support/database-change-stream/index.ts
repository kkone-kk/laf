import EventEmitter from 'events'
import { DatabaseAgent } from '../../db'
import { logger } from '../logger'
import Config from '../../config'
import {
  CLOUD_FUNCTION_COLLECTION,
  CONFIG_COLLECTION,
  WEBSITE_HOSTING_COLLECTION,
} from '../../constants'
import { ConfChangeStream } from './conf-change-stream'
import { WebsiteHostingChangeStream } from './website-hosting-change-stream'
import { FunctionCache } from '../engine'

const collectionsToWatch = [
  {
    name: CONFIG_COLLECTION,
    handler: () => ConfChangeStream,
  },
  {
    name: WEBSITE_HOSTING_COLLECTION,
    handler: () => WebsiteHostingChangeStream,
  },
  {
    name: CLOUD_FUNCTION_COLLECTION,
    handler: () => FunctionCache,
  },
] as const

export class DatabaseChangeStream extends EventEmitter {
  private static instance: DatabaseChangeStream

  private constructor() {
    super()
  }

  static getInstance() {
    if (!this.instance) {
      this.instance = new DatabaseChangeStream()
    }
    return this.instance
  }

  async initializeForCollection(collectionName: string) {
    try {
      // Check if the MongoDB instance supports change streams (replica set required)
      const adminDb = DatabaseAgent.client.db('admin')
      const serverStatus = await adminDb.command({ isMaster: 1 })

      if (!serverStatus.setName) {
        logger.warn(
          `Change streams not supported for ${collectionName}: MongoDB is not running as a replica set. Skipping change stream initialization.`,
        )
        return
      }

      const stream = DatabaseAgent.db.collection(collectionName).watch()

      stream.on('change', (change) => {
        this.emit(collectionName, change)
      })

      stream.on('error', (error: any) => {
        logger.error(
          `${collectionName} collection change stream error:`,
          error.message,
        )
        // Don't attempt to reconnect if it's a replica set error
        if (error.code === 40573) {
          logger.warn(
            `Disabling change streams for ${collectionName} due to replica set requirement`,
          )
          return
        }
      })

      stream.once('close', () => {
        stream.off('change', this.emit)
        logger.error(`${collectionName} collection change stream closed.`)

        setTimeout(() => {
          logger.info(
            `Reconnecting ${collectionName} collection change stream...`,
          )
          this.initializeForCollection(collectionName)
        }, Config.CHANGE_STREAM_RECONNECT_INTERVAL)
      })

      logger.info(`Change stream initialized for ${collectionName}`)
    } catch (error: any) {
      logger.error(
        `Failed to initialize change stream for ${collectionName}:`,
        error.message,
      )
      if (error.code === 40573 || error.message.includes('replica set')) {
        logger.warn(
          `Change streams disabled for ${collectionName}: requires replica set`,
        )
      }
    }
  }

  static async initialize() {
    const instance = DatabaseChangeStream.getInstance()

    for (const v of collectionsToWatch) {
      instance.initializeForCollection(v.name)
      // Ensure FunctionCache is initialized even without change streams
      await v.handler().initialize()
    }
  }

  static onStreamChange(
    collectionName: (typeof collectionsToWatch)[number]['name'],
    listener: (...args: any[]) => void,
  ) {
    const instance = DatabaseChangeStream.getInstance()
    instance.on(collectionName, listener)
  }

  static removeAllListeners() {
    const instance = DatabaseChangeStream.getInstance()
    instance.removeAllListeners()
  }
}
