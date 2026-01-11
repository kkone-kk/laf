import { Injectable, Logger } from '@nestjs/common'
import { ServerConfig } from '../constants'
import { SystemDatabase } from 'src/system-database'
import { ApplicationNamespaceMode, Region } from 'src/region/entities/region'
import { Runtime } from 'src/application/entities/runtime'
import { Setting, SettingKey } from 'src/setting/entities/setting'
import * as path from 'path'
import { readFileSync, readdirSync } from 'node:fs'

@Injectable()
export class InitializerService {
  private readonly logger = new Logger(InitializerService.name)
  private readonly db = SystemDatabase.db

  async init() {
    await this.createDefaultRegion()
    await this.createDefaultRuntime()
    await this.createDefaultSettings()
    await this.createNecessarySettings()
  }

  async createDefaultRegion() {
    // check if exists
    const existed = await this.db.collection<Region>('Region').countDocuments()
    if (existed) {
      this.logger.debug('region already exists')
      return
    }

    // create default region
    let mode = ApplicationNamespaceMode.AppId
    if (ServerConfig.DEFAULT_REGION_NAMESPACE) {
      mode = ApplicationNamespaceMode.Fixed
    }

    const files = readdirSync(path.resolve(__dirname, './deploy-manifest'))
    const manifest = files.reduce((prev, file) => {
      const key = file.slice(0, -path.extname(file).length)
      const value = readFileSync(
        path.resolve(__dirname, './deploy-manifest', file),
        'utf8',
      )
      prev[key] = value
      return prev
    }, {})

    const res = await this.db.collection<Region>('Region').insertOne({
      name: 'default',
      displayName: 'Default',
      namespaceConf: {
        mode: mode,
        prefix: '',
        fixed: ServerConfig.DEFAULT_REGION_NAMESPACE,
      },
      clusterConf: {
        driver: 'kubernetes',
        kubeconfig: null,
        npmInstallFlags: '',
        runtimeAffinity: {},
      },
      bundleConf: {
        cpuRequestLimitRatio: 0.1,
        memoryRequestLimitRatio: 0.5,
      },
      databaseConf: {
        driver: 'mongodb',
        connectionUri: ServerConfig.DEFAULT_REGION_DATABASE_URL,
        controlConnectionUri: ServerConfig.DEFAULT_REGION_DATABASE_URL,
        dedicatedDatabase: {
          enabled: false,
        },
      },
      storageConf: {
        driver: 'minio',
        domain: ServerConfig.DEFAULT_REGION_MINIO_DOMAIN,
        externalEndpoint: ServerConfig.DEFAULT_REGION_MINIO_EXTERNAL_ENDPOINT,
        internalEndpoint: ServerConfig.DEFAULT_REGION_MINIO_INTERNAL_ENDPOINT,
        accessKey: ServerConfig.DEFAULT_REGION_MINIO_ROOT_ACCESS_KEY,
        secretKey: ServerConfig.DEFAULT_REGION_MINIO_ROOT_SECRET_KEY,
        controlEndpoint: ServerConfig.DEFAULT_REGION_MINIO_INTERNAL_ENDPOINT,
      },
      gatewayConf: {
        driver: 'nginx',
        runtimeDomain: ServerConfig.DEFAULT_REGION_RUNTIME_DOMAIN,
        websiteDomain: ServerConfig.DEFAULT_REGION_WEBSITE_DOMAIN,
        port: 80,
        tls: {
          enabled: ServerConfig.DEFAULT_REGION_TLS_ENABLED,
          issuerRef: { name: 'laf-issuer', kind: 'Issuer' },
          wildcardCertificateSecretName:
            ServerConfig.DEFAULT_REGION_TLS_WILDCARD_CERTIFICATE_SECRET_NAME,
        },
      },
      logServerConf: {
        apiUrl: '',
        secret: '',
        databaseUrl: '',
      },
      prometheusConf: {
        apiUrl: ServerConfig.DEFAULT_REGION_PROMETHEUS_URL,
      },
      deployManifest: manifest,
      updatedAt: new Date(),
      createdAt: new Date(),
      state: 'Active',
    })

    this.logger.verbose(`Created default region`)
    return res
  }

  async createDefaultRuntime() {
    // check if exists
    const existed = await this.db
      .collection<Runtime>('Runtime')
      .countDocuments()
    if (existed) {
      this.logger.debug('default runtime already exists')
      return
    }

    // create default runtime
    const res = await this.db.collection<Runtime>('Runtime').insertOne({
      name: 'node',
      type: 'node:laf',
      image: {
        main: ServerConfig.DEFAULT_RUNTIME_IMAGE.image.main,
        init: ServerConfig.DEFAULT_RUNTIME_IMAGE.image.init,
      },
      version: ServerConfig.DEFAULT_RUNTIME_IMAGE.version,
      latest: true,
      state: 'Active',
    })

    this.logger.verbose('Created default runtime')
    return res
  }



  // create default settings
  async createDefaultSettings() {
    // check if exists
    const existed = await this.db
      .collection<Setting>('Setting')
      .countDocuments()

    if (existed) {
      this.logger.debug('default settings already exists')
      return
    }

    await this.db.collection<Setting>('Setting').insertOne({
      public: false,
      key: SettingKey.SignupBonus,
      value: '0',
      desc: 'Set up signup bonus',
    })

    await this.db.collection<Setting>('Setting').insertOne({
      public: true,
      key: SettingKey.InvitationProfit,
      value: '0',
      desc: 'Set up invitation rebate',
    })

    await this.db.collection<Setting>('Setting').insertOne({
      public: true,
      key: SettingKey.IdVerify,
      value: 'off', // on | off
      desc: 'real name authentication',
      metadata: {
        message: '',
        authenticateSite: '',
      },
    })

    await this.db.collection<Setting>('Setting').insertMany([
      {
        public: true,
        key: SettingKey.AiPilotUrl,
        value: 'https://htr4n1.laf.run/laf-gpt',
        desc: 'ai pilot url',
      },
      {
        public: true,
        key: SettingKey.LafForumUrl,
        value: 'https://forum.laf.run',
        desc: 'laf forum url',
      },
      {
        public: true,
        key: SettingKey.LafBusinessUrl,
        value: 'https://www.wenjuan.com/s/I36ZNbl',
        desc: 'laf business url',
      },
      {
        public: true,
        key: SettingKey.LafDiscordUrl,
        value:
          'https://discord.com/channels/1061659231599738901/1098516786170839050',
        desc: 'laf discord url',
      },
      {
        public: true,
        key: SettingKey.LafWeChatUrl,
        value: 'https://w4mci7-images.oss.laf.run/wechat.png',
        desc: 'laf wechat url',
      },
      {
        public: true,
        key: SettingKey.LafStatusUrl,
        value: 'https://hnpsxzqqtavv.cloud.sealos.cn/status/laf',
        desc: 'laf status url',
      },
      {
        public: true,
        key: SettingKey.LafAboutUsUrl,
        value: 'https://sealos.run/company/',
        desc: 'laf about us url',
      },
      {
        public: true,
        key: SettingKey.LafDocUrl,
        value: 'https://doc.laf.run/zh/',
        desc: 'laf doc site url',
      },
      {
        public: true,
        key: SettingKey.EnableWebPromoPage,
        value: 'true',
        desc: 'Whether to enable WebPromoPage',
      },
      {
        public: true,
        key: SettingKey.SealafNotification,
        value: 'off',
        desc: 'home page enable sealaf notification',
        metadata: {
          message: {
            zh: '',
            en: '',
          },
          gotoSite: '',
        },
      },
      {
        public: false,
        key: SettingKey.AppCreateTimeOut,
        value: '15',
        desc: 'timeout for application creation in minutes',
      },
    ])

    this.logger.verbose('Created default settings')
  }

  async createNecessarySettings() {
    const find = await this.db
      .collection<Setting>('Setting')
      .findOne({ key: SettingKey.DefaultUserQuota })

    if (!find) {
      await this.db.collection<Setting>('Setting').insertOne({
        public: false,
        key: SettingKey.DefaultUserQuota,
        value: 'default',
        desc: 'resource limit of user',
        metadata: {
          limitOfCPU: 20000,
          limitOfMemory: 20480,
          limitCountOfApplication: 20,
          limitOfDatabaseSyncCount: {
            countLimit: 10,
            timePeriodInSeconds: 86400,
          },
        },
      })
    }
  }
}
