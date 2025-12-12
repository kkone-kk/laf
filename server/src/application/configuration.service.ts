import { Injectable, Logger } from '@nestjs/common'
import { CN_PUBLISHED_CONF } from 'src/constants'
import { DatabaseService } from 'src/database/database.service'
import { SystemDatabase } from 'src/system-database'
import { ApplicationConfiguration } from './entities/application-configuration'
import { DedicatedDatabaseService } from 'src/database/dedicated-database/dedicated-database.service'

@Injectable()
export class ApplicationConfigurationService {
  private readonly db = SystemDatabase.db
  private readonly logger = new Logger(ApplicationConfigurationService.name)

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly dedicatedDatabaseService: DedicatedDatabaseService,
  ) {}

  async count(appid: string) {
    return this.db
      .collection<ApplicationConfiguration>('ApplicationConfiguration')
      .countDocuments({ appid })
  }

  async remove(appid: string) {
    return this.db
      .collection<ApplicationConfiguration>('ApplicationConfiguration')
      .deleteOne({ appid })
  }

  async publish(conf: ApplicationConfiguration) {
    const database =
      (await this.dedicatedDatabaseService.findAndConnect(conf.appid)) ||
      (await this.databaseService.findAndConnect(conf.appid))
    const { db, client } = database
    try {
      const coll = db.collection(CN_PUBLISHED_CONF)
      await coll.deleteMany({})
      await coll.insertOne(conf)
    } finally {
      await client.close()
    }
  }
}
