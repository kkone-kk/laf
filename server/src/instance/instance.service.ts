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
  ) {}

  public async create(appid: string) {
    const app = await this.applicationService.findOneUnsafe(appid)
    await this.createProcess(app)
  }

  public async remove(appid: string) {
    await this.processManager.stopProcess(appid)
    this.logger.log(`remove process ${appid}`)
  }

  public async get(appid: string) {
    const app = await this.applicationService.findOneUnsafe(appid)
    const process = this.processManager.getProcess(appid)
    // mock deployment/service/hpa structure to satisfy return type if needed,
    // or better yet, refactor the caller to not expect k8s objects.
    // For now, returning nulls but with app

    // We return a structure that mimics what was returned before but with nulls for k8s objects
    // If callers depend on these objects, we might need to mock them more convincingly or change the callers.
    return { deployment: process ? {} as any : null, service: process ? {} as any : null, hpa: null, app }
  }

  public async restart(appid: string) {
    await this.remove(appid)
    await this.create(appid)
  }

  private async createProcess(app: ApplicationWithRelations) {
    const appid = app.appid
    const region = app.region
    assert(region, 'region is required')

    // prepare params
    const limitMemory = app.bundle.resource.limitMemory
    const max_old_space_size = ~~(limitMemory * 0.8)
    const max_http_header_size = 1 * MB
    const dependencies = app.configuration?.dependencies || []
    const dependencies_string = dependencies.join(' ')
    const npm_install_flags = region.clusterConf.npmInstallFlags || ''

    // db connection uri
    let dbConnectionUri: string
    const dedicatedDatabase = await this.dedicatedDatabaseService.findOne(appid)
    if (dedicatedDatabase) {
      // Logic for dedicated database might need adjustment for local,
      // but assuming it returns a valid connection string for now.
       dbConnectionUri = await this.dedicatedDatabaseService.getConnectionUri(
        region,
        dedicatedDatabase,
      )
    } else {
      const database = await this.databaseService.findOne(appid)
      // Assuming getInternalConnectionUri returns a valid URI reachable from localhost
      dbConnectionUri = this.databaseService.getInternalConnectionUri(
        region,
        database,
      )
    }

    const storage = await this.storageService.findOne(appid)
    const NODE_MODULES_PUSH_URL =
      await this.cloudbin.getNodeModulesCachePushUrl(appid)

    const NODE_MODULES_PULL_URL =
      await this.cloudbin.getNodeModulesCachePullUrl(appid)

    const env = {
      DB_URI: dbConnectionUri,
      APP_ID: appid,
      APPID: appid,
      OSS_ACCESS_KEY: storage.accessKey,
      OSS_ACCESS_SECRET: storage.secretKey,
      OSS_INTERNAL_ENDPOINT: region.storageConf.internalEndpoint,
      OSS_EXTERNAL_ENDPOINT: region.storageConf.externalEndpoint,
      OSS_REGION: region.name,
      FLAGS: `--max_old_space_size=${max_old_space_size} --max-http-header-size=${max_http_header_size}`,
      DEPENDENCIES: dependencies_string,
      NODE_MODULES_PUSH_URL: NODE_MODULES_PUSH_URL,
      NODE_MODULES_PULL_URL: NODE_MODULES_PULL_URL,
      NPM_INSTALL_FLAGS: npm_install_flags,
      CUSTOM_DEPENDENCY_BASE_PATH: ServerConfig.RUNTIME_CUSTOM_DEPENDENCY_BASE_PATH,
      RESTART_AT: new Date().getTime().toString(),
    }

    // merge env from app configuration, override if exists
    const extraEnv = app.configuration.environments || []
    extraEnv.forEach((e) => {
      env[e.name] = e.value
    })

    await this.processManager.startProcess(appid, env)
  }

}
