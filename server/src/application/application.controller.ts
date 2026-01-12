import {
  Controller,
  Get,
  Body,
  Patch,
  Param,
  UseGuards,
  Logger,
  Post,
  Delete,
  ForbiddenException,
} from '@nestjs/common'
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger'
import {
  ApiResponseArray,
  ApiResponseObject,
  ResponseUtil,
} from '../utils/response'
import {
  UpdateApplicationBundleDto,
  UpdateApplicationNameDto,
  UpdateApplicationStateDto,
} from './dto/update-application.dto'
import { ApplicationService } from './application.service'
import { FunctionService } from '../function/function.service'
import { StorageService } from 'src/storage/storage.service'
import { RegionService } from 'src/region/region.service'
import { CreateApplicationDto } from './dto/create-application.dto'
import {
  Application,
  ApplicationPhase,
  ApplicationState,
  ApplicationWithRelations,
} from './entities/application'
import { SystemDatabase } from 'src/system-database'
import { Runtime } from './entities/runtime'
import { ObjectId } from 'mongodb'
import { ApplicationBundle } from './entities/application-bundle'
import { RuntimeDomainService } from 'src/gateway/runtime-domain.service'
import { BindCustomDomainDto } from 'src/website/dto/update-website.dto'
import { RuntimeDomain } from 'src/gateway/entities/runtime-domain'
import { InjectApplication } from 'src/utils/decorator'
import { isEqual } from 'lodash'
import { InstanceService } from 'src/instance/instance.service'
import { DedicatedDatabaseService } from 'src/database/dedicated-database/dedicated-database.service'
import {
  DedicatedDatabasePhase,
  DedicatedDatabaseState,
} from 'src/database/entities/dedicated-database'
import { DEFAULT_USER_ID } from 'src/constants'

@ApiTags('Application')
@Controller('applications')
@ApiBearerAuth('Authorization')
export class ApplicationController {
  private logger = new Logger(ApplicationController.name)

  constructor(
    private readonly application: ApplicationService,
    private readonly instance: InstanceService,
    private readonly fn: FunctionService,
    private readonly region: RegionService,
    private readonly storage: StorageService,
    private readonly runtimeDomain: RuntimeDomainService,
    private readonly dedicateDatabase: DedicatedDatabaseService,
  ) {}

  /**
   * Create application
   */
  @ApiOperation({ summary: 'Create application' })
  @ApiResponseObject(ApplicationWithRelations)
  @Post()
  async create(@Body() dto: CreateApplicationDto) {
    const error = dto.validate() || dto.autoscaling.validate()
    if (error) {
      return ResponseUtil.error(error)
    }

    // check regionId exists
    const region = await this.region.findOne(new ObjectId(dto.regionId))
    if (!region) {
      return ResponseUtil.error(`region ${dto.regionId} not found`)
    }

    // check runtimeId exists
    const runtime = await SystemDatabase.db
      .collection<Runtime>('Runtime')
      .findOne({ _id: new ObjectId(dto.runtimeId) })
    if (!runtime) {
      return ResponseUtil.error(`runtime ${dto.runtimeId} not found`)
    }

    const regionId = region._id

    if (
      dto.dedicatedDatabase &&
      !region.databaseConf.dedicatedDatabase.enabled
    ) {
      return ResponseUtil.error('dedicated database is not enabled')
    }

    // create application
    const appid = await this.application.tryGenerateUniqueAppid()
    await this.application.create(
      regionId,
      DEFAULT_USER_ID,
      appid,
      dto,
      false,
    )

    const app = await this.application.findOne(appid)
    return ResponseUtil.ok(app)
  }

  /**
   * Get user application list
   * @param req
   * @returns
   */
  @Get()
  @ApiOperation({ summary: 'Get user application list' })
  @ApiResponseArray(ApplicationWithRelations)
  async findAll() {
    const data = await this.application.findAllByUser(DEFAULT_USER_ID)
    return ResponseUtil.ok(data)
  }

  /**
   * Get an application by appid
   * @param appid
   * @returns
   */
  @ApiOperation({ summary: 'Get an application by appid' })
  @Get(':appid')
  async findOne(@Param('appid') appid: string) {
    const data = await this.application.findOne(appid)

    // SECURITY ALERT!!!
    // DO NOT response this region object to client since it contains sensitive information
    const region = await this.region.findOne(data.regionId)

    // TODO: remove these storage related code to standalone api
    let storage = {}
    const storageUser = await this.storage.findOne(appid)
    if (storageUser) {
      storage = {
        endpoint: region.storageConf.externalEndpoint,
        ...storageUser,
      }
    }

    // Generate the develop token, it's provided to the client when debugging function
    const expires = 60 * 60 * 24 * 7
    const develop_token = await this.fn.generateRuntimeToken(
      appid,
      'develop',
      expires,
    )
    const openapi_token = await this.fn.generateRuntimeToken(
      appid,
      'openapi',
      expires,
    )

    const res = {
      ...data,
      storage: storage,
      port: region.gatewayConf.port,
      develop_token: develop_token,
      openapi_token: openapi_token,

      /** This is the redundant field of Region */
      tls: region.gatewayConf.tls.enabled,
      dedicatedDatabase: region.databaseConf.dedicatedDatabase.enabled,
    }

    return ResponseUtil.ok(res)
  }

  /**
   * Update application name
   */
  @ApiOperation({ summary: 'Update application name' })
  @ApiResponseObject(Application)
  @Patch(':appid/name')
  async updateName(
    @Param('appid') appid: string,
    @Body() dto: UpdateApplicationNameDto,
  ) {
    const doc = await this.application.updateName(appid, dto.name)
    return ResponseUtil.ok(doc)
  }

  /**
   * Update application state
   */
  @ApiOperation({ summary: 'Update application state' })
  @ApiResponseObject(Application)
  @Patch(':appid/state')
  async updateState(
    @Param('appid') appid: string,
    @Body() dto: UpdateApplicationStateDto,
    @InjectApplication() app: Application,
  ) {
    if (dto.state === ApplicationState.Deleted) {
      throw new ForbiddenException('cannot update state to deleted')
    }
    const ddb = await this.dedicateDatabase.findOne(appid)

    // check: only running application can restart
    if (
      dto.state === ApplicationState.Restarting &&
      !(
        app.state === ApplicationState.Running &&
        app.phase === ApplicationPhase.Started
      )
    ) {
      return ResponseUtil.error(
        'The application is not running, can not restart it',
      )
    }

    // check: only running application can stop
    if (
      dto.state === ApplicationState.Stopped &&
      (app.state !== ApplicationState.Running ||
        app.phase !== ApplicationPhase.Started)
    ) {
      return ResponseUtil.error(
        'The application is not running, can not stop it',
      )
    }

    // check: only stopped application can start
    if (
      dto.state === ApplicationState.Running &&
      (app.state !== ApplicationState.Stopped ||
        app.phase !== ApplicationPhase.Stopped)
    ) {
      return ResponseUtil.error(
        'The application is not stopped, can not start it',
      )
    }

    if (ddb) {
      if (dto.state === ApplicationState.Restarting && dto?.onlyRuntimeFlag) {
        const doc = await this.application.updateState(appid, dto.state)
        return ResponseUtil.ok(doc)
      }

      const doc = await this.application.updateState(appid, dto.state)
      await this.dedicateDatabase.updateState(
        appid,
        dto.state as unknown as DedicatedDatabaseState,
      )
      return ResponseUtil.ok(doc)
    }

    const doc = await this.application.updateState(appid, dto.state)
    return ResponseUtil.ok(doc)
  }

  /**
   * Update application bundle
   */
  @ApiOperation({ summary: 'Update application bundle' })
  @ApiResponseObject(ApplicationBundle)
  @Patch(':appid/bundle')
  async updateBundle(
    @Param('appid') appid: string,
    @Body() dto: UpdateApplicationBundleDto,
    @InjectApplication() app: ApplicationWithRelations,
  ) {
    // only running application can update bundle
    if (app.phase !== ApplicationPhase.Started) {
      return ResponseUtil.error(
        'The application is not running, can not update bundle',
      )
    }

    const error = dto.autoscaling.validate()
    if (error) {
      return ResponseUtil.error(error)
    }

    const regionId = app.regionId

    const origin = app.bundle
    if (
      (origin.resource.dedicatedDatabase?.limitCPU && dto.databaseCapacity) ||
      (origin.resource.databaseCapacity && dto.dedicatedDatabase?.cpu)
    ) {
      return ResponseUtil.error('cannot change database type')
    }

    // Check if user is trying to change dedicated database resources
    const isTryingToChangeDedicatedDatabase =
      (dto.dedicatedDatabase?.cpu !== undefined &&
        dto.dedicatedDatabase?.cpu !==
          origin.resource.dedicatedDatabase?.limitCPU) ||
      (dto.dedicatedDatabase?.memory !== undefined &&
        dto.dedicatedDatabase?.memory !==
          origin.resource.dedicatedDatabase?.limitMemory) ||
      (dto.dedicatedDatabase?.replicas !== undefined &&
        dto.dedicatedDatabase?.replicas !==
          origin.resource.dedicatedDatabase?.replicas) ||
      (dto.dedicatedDatabase?.capacity !== undefined &&
        dto.dedicatedDatabase?.capacity !==
          origin.resource.dedicatedDatabase?.capacity)

    if (isTryingToChangeDedicatedDatabase) {
      const ddb = await this.dedicateDatabase.findOne(appid)
      // Database must be running to change database resources
      if (!ddb) {
        return ResponseUtil.error(
          'DedicatedDatabase not found, cannot change DedicatedDatabase database resources',
        )
      }
      if (
        ddb.state !== DedicatedDatabaseState.Running ||
        ddb.phase !== DedicatedDatabasePhase.Started
      ) {
        return ResponseUtil.error(
          'DedicatedDatabase is not in running state, cannot change DedicatedDatabase database resources',
        )
      }
    }

    if (
      dto.dedicatedDatabase?.capacity &&
      origin.resource.dedicatedDatabase?.capacity &&
      dto.dedicatedDatabase?.capacity <
        origin.resource.dedicatedDatabase?.capacity
    ) {
      return ResponseUtil.error('cannot reduce database capacity')
    }

    if (
      dto.dedicatedDatabase?.replicas &&
      origin.resource.dedicatedDatabase?.replicas &&
      dto.dedicatedDatabase?.replicas <
        origin.resource.dedicatedDatabase?.replicas
    ) {
      return ResponseUtil.error(
        'To reduce the number of database replicas, please contact customer support.',
      )
    }

    const doc = await this.application.updateBundle(appid, dto, false)

    // restart running application if cpu or memory changed
    const isCpuChanged = origin.resource.limitCPU !== doc.resource.limitCPU
    const isMemoryChanged =
      origin.resource.limitMemory !== doc.resource.limitMemory
    const isAutoscalingCanceled =
      !doc.autoscaling.enable && origin.autoscaling.enable

    const isRuntimeChanged =
      isCpuChanged || isMemoryChanged || isAutoscalingCanceled

    const isDedicatedDatabaseChanged =
      !!origin.resource.dedicatedDatabase &&
      (!isEqual(
        origin.resource.dedicatedDatabase.limitCPU,
        doc.resource.dedicatedDatabase.limitCPU,
      ) ||
        !isEqual(
          origin.resource.dedicatedDatabase.limitMemory,
          doc.resource.dedicatedDatabase.limitMemory,
        ) ||
        !isEqual(
          origin.resource.dedicatedDatabase.replicas,
          doc.resource.dedicatedDatabase.replicas,
        ) ||
        !isEqual(
          origin.resource.dedicatedDatabase.capacity,
          doc.resource.dedicatedDatabase.capacity,
        ))

    if (!isEqual(doc.autoscaling, origin.autoscaling)) {
      const { hpa, app } = await this.instance.get(appid)
      await this.instance.reapplyHorizontalPodAutoscaler(app, hpa)
    }

    if (isDedicatedDatabaseChanged) {
      await this.application.updateState(appid, ApplicationState.Restarting)
      await this.dedicateDatabase.updateState(
        appid,
        DedicatedDatabaseState.Restarting,
      )
      return ResponseUtil.ok(doc)
    }

    if (isRuntimeChanged) {
      await this.application.updateState(appid, ApplicationState.Restarting)
    }

    return ResponseUtil.ok(doc)
  }

  /**
   * Bind custom domain to application
   */
  @ApiResponseObject(RuntimeDomain)
  @ApiOperation({ summary: 'Bind custom domain to application' })
  @Patch(':appid/domain')
  async bindDomain(
    @Param('appid') appid: string,
    @Body() dto: BindCustomDomainDto,
  ) {
    const runtimeDomain = await this.runtimeDomain.findOne(appid)
    if (
      runtimeDomain?.customDomain &&
      runtimeDomain.customDomain === dto.domain
    ) {
      return ResponseUtil.error('domain already binded')
    }

    // check if domain resolved
    const resolved = await this.runtimeDomain.checkResolved(appid, dto.domain)
    if (!resolved) {
      return ResponseUtil.error('domain not resolved')
    }

    // bind domain
    const binded = await this.runtimeDomain.bindCustomDomain(appid, dto.domain)
    if (!binded) {
      return ResponseUtil.error('failed to bind domain')
    }

    return ResponseUtil.ok(binded)
  }

  /**
   * Check if domain is resolved
   */
  @ApiResponse({ type: ResponseUtil<boolean> })
  @ApiOperation({ summary: 'Check if domain is resolved' })
  @Post(':appid/domain/resolved')
  async checkResolved(
    @Param('appid') appid: string,
    @Body() dto: BindCustomDomainDto,
  ) {
    const resolved = await this.runtimeDomain.checkResolved(appid, dto.domain)
    if (!resolved) {
      return ResponseUtil.error('domain not resolved')
    }

    return ResponseUtil.ok(resolved)
  }

  /**
   * Remove custom domain of application
   */
  @ApiResponseObject(RuntimeDomain)
  @ApiOperation({ summary: 'Remove custom domain of application' })
  @Delete(':appid/domain')
  async remove(@Param('appid') appid: string) {
    const runtimeDomain = await this.runtimeDomain.findOne(appid)
    if (!runtimeDomain?.customDomain) {
      return ResponseUtil.error('custom domain not found')
    }

    const deleted = await this.runtimeDomain.removeCustomDomain(appid)
    if (!deleted) {
      return ResponseUtil.error('failed to remove custom domain')
    }

    return ResponseUtil.ok(deleted)
  }

  /**
   * Delete an application
   */
  @ApiOperation({ summary: 'Delete an application' })
  @ApiResponseObject(Application)
  @Delete(':appid')
  async delete(
    @Param('appid') appid: string,
    @InjectApplication() app: ApplicationWithRelations,
  ) {
    // check: only stopped application can be deleted
    if (
      app.state !== ApplicationState.Stopped &&
      app.phase !== ApplicationPhase.Stopped
    ) {
      return ResponseUtil.error('The app is not stopped, can not delete it')
    }

    const doc = await this.application.remove(appid)
    return ResponseUtil.ok(doc)
  }

}
