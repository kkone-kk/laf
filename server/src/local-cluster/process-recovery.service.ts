import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { ProcessManagerService } from './process-manager.service'
import { ApplicationService } from 'src/application/application.service'
import { ApplicationState } from 'src/application/entities/application'
import { SystemDatabase } from 'src/system-database'
import { ApplicationConfigurationService } from 'src/application/configuration.service'

@Injectable()
export class ProcessRecoveryService implements OnModuleInit {
  private readonly logger = new Logger(ProcessRecoveryService.name)

  constructor(
    private readonly processManager: ProcessManagerService,
    private readonly appConfigService: ApplicationConfigurationService,
  ) {}

  async onModuleInit() {
    this.logger.log('Starting process recovery...')
    await this.recoverProcesses()
  }

  private async recoverProcesses() {
    const db = SystemDatabase.db
    const apps = await db
      .collection('Application')
      .find({ state: ApplicationState.Running })
      .toArray()

    this.logger.log(`Found ${apps.length} running applications to recover.`)

    for (const app of apps) {
      try {
        const conf = await this.appConfigService.findOne(app.appid)
        const envs = conf?.environments || []
        const envObj = envs.reduce((acc, cur) => ({ ...acc, [cur.name]: cur.value }), {})

        await this.processManager.startProcess(app.appid, envObj)
        this.logger.log(`Recovered process for app ${app.appid}`)
      } catch (error) {
        this.logger.error(`Failed to recover process for app ${app.appid}`, error)
      }
    }
  }
}
