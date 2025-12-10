import { Injectable, Logger } from '@nestjs/common'
import { Region } from 'src/region/entities/region'
import {
  DedicatedDatabase,
  DedicatedDatabasePhase,
  DedicatedDatabaseSpec,
  DedicatedDatabaseState,
} from '../entities/dedicated-database'
import { RegionService } from 'src/region/region.service'
import { SystemDatabase } from 'src/system-database'
import { TASK_LOCK_INIT_TIME, ServerConfig } from 'src/constants'
import { ClientSession } from 'mongodb'
import { MongoService } from 'src/database/mongo.service'
import { MongoAccessor } from 'database-proxy'
import { ApplicationBundle } from 'src/application/entities/application-bundle'
import * as mongodbUri from 'mongodb-uri'

@Injectable()
export class DedicatedDatabaseService {
  private readonly logger = new Logger(DedicatedDatabase.name)
  constructor(
    private readonly regionService: RegionService,
    private readonly mongoService: MongoService,
  ) {}

  async create(appid: string, session?: ClientSession) {
    const db = SystemDatabase.db

    await db.collection<DedicatedDatabase>('DedicatedDatabase').insertOne(
      {
        appid,
        name: appid,
        createdAt: new Date(),
        updatedAt: new Date(),
        lockedAt: TASK_LOCK_INIT_TIME,
        phase: DedicatedDatabasePhase.Started, // Skip creation phase
        state: DedicatedDatabaseState.Running,
      },
      { session },
    )
  }

  async applyDeployManifest(
    region: Region,
    appid: string,
    patch?: Partial<DedicatedDatabaseSpec>,
  ) {
    // No-op for local
    return {}
  }

  async updateDeployManifest(region: Region, appid: string) {
    // No-op for local
    return null
  }

  async getDedicatedDatabaseSpec(
    appid: string,
  ): Promise<DedicatedDatabaseSpec> {
    const db = SystemDatabase.db

    const bundle = await db
      .collection<ApplicationBundle>('ApplicationBundle')
      .findOne({ appid })

    return bundle.resource.dedicatedDatabase
  }

  async findOne(appid: string) {
    const db = SystemDatabase.db

    const res = await db
      .collection<DedicatedDatabase>('DedicatedDatabase')
      .findOne({
        appid,
      })

    return res
  }

  async deleteDeployManifest(region: Region, appid: string) {
    return {}
  }

  async getDeployManifest(region: Region, appid: string) {
    // Mock
    return { spec: { componentSpecs: [{ replicas: 1 }] } } as any
  }

  async isDeployManifestChanged(
    region: Region,
    appid: string,
  ): Promise<boolean> {
    return false
  }

  async applyKubeBlockOpsRequestManifest(
    region: Region,
    appid: string,
    type: 'restart' | 'stop' | 'start' = 'restart',
  ) {
    return {}
  }

  async applyKubeBlockOpsRequestManifestForSpec(
    region: Region,
    appid: string,
    spec: DedicatedDatabaseSpec,
    type: 'verticalScaling' | 'horizontalScaling' | 'volumeExpansion',
  ) {
    return {}
  }

  async deleteKubeBlockOpsManifest(
    region: Region,
    appid: string,
    type: 'restart' | 'stop' | 'start' = 'restart',
  ) {
      return {}
  }

  async deleteKubeBlockOpsManifestForSpec(
    region: Region,
    appid: string,
    type: 'verticalScaling' | 'horizontalScaling' | 'volumeExpansion',
  ) {
      return {}
  }

  async updateState(appid: string, state: DedicatedDatabaseState) {
    const db = SystemDatabase.db
    const res = await db
      .collection<DedicatedDatabase>('DedicatedDatabase')
      .findOneAndUpdate(
        { appid },
        { $set: { state, updatedAt: new Date() } },
        { returnDocument: 'after' },
      )

    return res.value
  }

  async getConnectionUri(region: Region, database: DedicatedDatabase) {
    // Use mongodb-uri to parse and replace database name safely
    const parsed = mongodbUri.parse(ServerConfig.DATABASE_URL)
    parsed.database = database.name
    return mongodbUri.format(parsed)
  }

  async findAndConnect(appid: string) {
    const database = await this.findOne(appid)
    if (!database) return null

    const region = await this.regionService.findByAppId(appid)
    const connectionUri = await this.getConnectionUri(region, database)

    const client = await this.mongoService.connectDatabase(
      connectionUri,
      database.name,
    )
    const db = client.db(database.name)
    return { db, client }
  }

  async getDatabaseAccessor(appid: string) {
    const database = await this.findOne(appid)
    if (!database) return null

    const { client } = await this.findAndConnect(appid)

    const accessor = new MongoAccessor(client)
    return accessor
  }

  async remove(appid: string) {
    const db = SystemDatabase.db
    const doc = await db
      .collection<DedicatedDatabase>('DedicatedDatabase')
      .findOneAndUpdate(
        { appid },
        {
          $set: {
            state: DedicatedDatabaseState.Deleted,
            phase: DedicatedDatabasePhase.Deleting,
            updatedAt: new Date(),
          },
        },
        { returnDocument: 'after' },
      )

    return doc.value
  }

  async databaseConnectionIsOk(appid: string): Promise<boolean> {
    return true
  }
}
