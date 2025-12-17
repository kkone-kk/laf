import { Injectable, Logger } from '@nestjs/common'
import { GetApplicationNamespace } from 'src/utils/getter'
import { LABEL_KEY_APP_ID, MB, ServerConfig } from '../constants'
import { StorageService } from '../storage/storage.service'
import { DatabaseService } from 'src/database/database.service'
import { ClusterService } from 'src/region/cluster/cluster.service'
import { ApplicationWithRelations } from 'src/application/entities/application'
import { ApplicationService } from 'src/application/application.service'
import * as assert from 'assert'
import { CloudBinBucketService } from 'src/storage/cloud-bin-bucket.service'
import { DedicatedDatabaseService } from 'src/database/dedicated-database/dedicated-database.service'
import { ProcessManagerService } from 'src/local-cluster/process-manager.service'

@Injectable()
export class InstanceService {
  private readonly logger = new Logger('InstanceService')

  constructor(
    private readonly cluster: ClusterService,
    private readonly storageService: StorageService,
    private readonly databaseService: DatabaseService,
    private readonly dedicatedDatabaseService: DedicatedDatabaseService,
    private readonly applicationService: ApplicationService,
    private readonly cloudbin: CloudBinBucketService,
    private readonly processManager: ProcessManagerService,
  ) { }

  public async create(appid: string) {
    this.logger.log(`Creating instance for app ${appid} (shared runtime mode)`)
    const app = await this.applicationService.findOneUnsafe(appid)

    // In shared runtime mode, we just ensure the shared runtime is running
    // and prepare the environment for the app
    await this.prepareSharedRuntimeEnvironment(app)
  }

  public async remove(appid: string) {
    this.logger.log(`Removing instance for app ${appid} (shared runtime mode)`)
    // In shared runtime mode, we don't stop the shared runtime for individual apps
    // The shared runtime continues running and will handle app-specific cleanup
  }

  public async get(appid: string) {
    const app = await this.applicationService.findOneUnsafe(appid)
    const sharedRuntimeRunning = this.processManager.isSharedRuntimeRunning()

    // Return a structure that indicates the app is "deployed" if shared runtime is running
    return {
      deployment: sharedRuntimeRunning ? { status: { readyReplicas: 1, unavailableReplicas: 0 } } : null,
      service: sharedRuntimeRunning ? { spec: { ports: [{ port: this.processManager.getSharedRuntimePort() }] } } : null,
      hpa: null,
      app
    }
  }

  public async restart(appid: string) {
    this.logger.log(`Restarting instance for app ${appid} (shared runtime mode)`)
    // In shared runtime mode, we restart the shared runtime instead of individual apps
    await this.processManager.restartSharedRuntime()
  }

  private async prepareSharedRuntimeEnvironment(app: ApplicationWithRelations) {
    const appid = app.appid
    this.logger.log(`Preparing shared runtime environment for app ${appid}`)

    // In shared runtime mode, we just ensure the shared runtime is running
    // The runtime will handle app-specific configuration through database queries
    await this.processManager.ensureSharedRuntimeRunning()

    // The shared runtime will read app configuration from the database
    // No need to pass environment variables per app
    this.logger.log(`Shared runtime environment prepared for app ${appid}`)
  }

}
