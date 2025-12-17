import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  HttpException,
  HttpStatus,
  Req,
  Put,
  Query,
} from '@nestjs/common'
import { CreateFunctionDto } from './dto/create-function.dto'
import { UpdateFunctionDto } from './dto/update-function.dto'
import {
  ApiResponseArray,
  ApiResponseObject,
  ResponseUtil,
} from '../utils/response'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { FunctionService } from './function.service'
import { IRequest } from '../utils/interface'
import { CompileFunctionDto } from './dto/compile-function.dto'
import { BundleService } from 'src/application/bundle.service'
import { I18n, I18nContext, I18nService } from 'nestjs-i18n'
import { I18nTranslations } from '../generated/i18n.generated'
import { JwtAuthGuard } from 'src/authentication/jwt.auth.guard'
import { ApplicationAuthGuard } from 'src/authentication/application.auth.guard'
import { CloudFunctionHistory } from './entities/cloud-function-history'
import { CloudFunction } from './entities/cloud-function'
import { UpdateFunctionDebugDto } from './dto/update-function-debug.dto'
import { FunctionRecycleBinService } from 'src/recycle-bin/cloud-function/function-recycle-bin.service'
import { FunctionRuntimeService } from './function-runtime.service'
import { BatchDeploymentService, BatchDeploymentRequest } from './batch-deployment.service'
import { PerformanceMonitorService } from './performance-monitor.service'
import { FunctionCacheService } from './function-cache.service'
import { STORAGE_LIMIT } from 'src/constants'

@ApiTags('Function')
@ApiBearerAuth('Authorization')
@Controller('apps/:appid/functions')
export class FunctionController {
  constructor(
    private readonly functionsService: FunctionService,
    private readonly bundleService: BundleService,
    private readonly functionRecycleBinService: FunctionRecycleBinService,
    private readonly functionRuntimeService: FunctionRuntimeService,
    private readonly batchDeploymentService: BatchDeploymentService,
    private readonly performanceMonitorService: PerformanceMonitorService,
    private readonly functionCacheService: FunctionCacheService,
    private readonly i18n: I18nService<I18nTranslations>,
  ) { }

  /**
   * Create a new function
   * @param dto
   * @returns
   */
  @ApiResponseObject(CloudFunction)
  @ApiOperation({ summary: 'Create a new function' })
  @UseGuards(JwtAuthGuard, ApplicationAuthGuard)
  @Post()
  async create(
    @Param('appid') appid: string,
    @Body() dto: CreateFunctionDto,
    @Req() req: IRequest,
    @I18n() i18n: I18nContext<I18nTranslations>,
  ) {
    const error = dto.validate()
    if (error) {
      return ResponseUtil.error(error)
    }

    // check name is unique
    const found = await this.functionsService.findOne(appid, dto.name)
    if (found) {
      return ResponseUtil.error(
        i18n.t('function.create.nameExist', { args: { name: dto.name } }),
      )
    }

    // check if meet the count limit
    const bundle = await this.bundleService.findOne(appid)
    const MAX_FUNCTION_COUNT = bundle?.resource?.limitCountOfCloudFunction || 0
    const count = await this.functionsService.count(appid)
    if (count >= MAX_FUNCTION_COUNT) {
      return ResponseUtil.error(
        i18n.t('function.create.maxCount', {
          args: { count: MAX_FUNCTION_COUNT },
        }),
      )
    }

    const res = await this.functionsService.create(appid, req.user._id, dto)
    if (!res) {
      return ResponseUtil.error(i18n.t('function.create.error'))
    }
    return ResponseUtil.ok(res)
  }

  /**
   * Query function list of an app
   * @returns
   */
  @ApiResponseArray(CloudFunction)
  @ApiOperation({ summary: 'Query function list of an app' })
  @UseGuards(JwtAuthGuard, ApplicationAuthGuard)
  @Get()
  async findAll(@Param('appid') appid: string) {
    const data = await this.functionsService.findAll(appid)
    return ResponseUtil.ok(data)
  }

  /**
   * Get a function by its name
   * @param appid
   * @param name
   */
  @ApiResponseObject(CloudFunction)
  @ApiOperation({ summary: 'Get a function by its name' })
  @UseGuards(JwtAuthGuard, ApplicationAuthGuard)
  @Get(':name')
  async findOne(
    @Param('appid') appid: string,
    @Param('name') name: string,
    @I18n() i18n: I18nContext<I18nTranslations>,
  ) {
    const data = await this.functionsService.findOne(appid, name)
    if (!data) {
      throw new HttpException(
        i18n.t('function.common.notFound', { args: { name } }),
        HttpStatus.NOT_FOUND,
      )
    }
    return ResponseUtil.ok(data)
  }

  /**
   * Update function debug info
   * @param appid
   * @param name
   * @param dto
   * @returns
   */
  @ApiResponseObject(CloudFunction)
  @ApiOperation({ summary: 'Update function debug info' })
  @UseGuards(JwtAuthGuard, ApplicationAuthGuard)
  @Patch(':name/debug/params')
  async updateDebug(
    @Param('appid') appid: string,
    @Param('name') name: string,
    @Body() dto: UpdateFunctionDebugDto,
    @I18n() i18n: I18nContext<I18nTranslations>,
  ) {
    const func = await this.functionsService.findOne(appid, name)
    if (!func) {
      throw new HttpException(
        i18n.t('function.common.notFound', { args: { name } }),
        HttpStatus.NOT_FOUND,
      )
    }

    const res = await this.functionsService.updateOneDebug(func, dto)
    if (!res) {
      return ResponseUtil.error(i18n.t('function.update.error'))
    }
    return ResponseUtil.ok(res)
  }

  /**
   * Update a function
   * @param appid
   * @param name
   * @param dto
   * @returns
   */
  @ApiResponseObject(CloudFunction)
  @ApiOperation({ summary: 'Update a function' })
  @UseGuards(JwtAuthGuard, ApplicationAuthGuard)
  @Patch(':name')
  async update(
    @Param('appid') appid: string,
    @Param('name') name: string,
    @Body() dto: UpdateFunctionDto,
    @I18n() i18n: I18nContext<I18nTranslations>,
  ) {
    const func = await this.functionsService.findOne(appid, name)
    if (!func) {
      throw new HttpException(
        i18n.t('function.common.notFound', { args: { name } }),
        HttpStatus.NOT_FOUND,
      )
    }
    const res = await this.functionsService.updateOne(func, dto)
    if (!res) {
      return ResponseUtil.error(i18n.t('function.update.error'))
    }
    if (res instanceof Error) {
      return ResponseUtil.error(res.message)
    }

    return ResponseUtil.ok(res)
  }

  /**
   * Delete a function
   * @param appid
   * @param name
   * @returns
   */
  @ApiResponseObject(CloudFunction)
  @ApiOperation({ summary: 'Delete a function' })
  @UseGuards(JwtAuthGuard, ApplicationAuthGuard)
  @Delete(':name')
  async remove(
    @Param('appid') appid: string,
    @Param('name') name: string,
    @I18n() i18n: I18nContext<I18nTranslations>,
  ) {
    const func = await this.functionsService.findOne(appid, name)
    if (!func) {
      throw new HttpException(
        i18n.t('function.common.notFound', { args: { name } }),
        HttpStatus.NOT_FOUND,
      )
    }
    const recycleBinStorage =
      await this.functionRecycleBinService.getRecycleBinStorage(appid)

    if (recycleBinStorage >= STORAGE_LIMIT) {
      return ResponseUtil.error('Recycle bin is full, please free up space')
    }

    const res = await this.functionsService.removeOne(func)
    if (!res) {
      return ResponseUtil.error(i18n.t('function.delete.error'))
    }
    return ResponseUtil.ok(res)
  }

  /**
   * Compile a function
   * @param appid
   * @param name
   * @returns
   */
  @ApiResponseObject(CloudFunction)
  @ApiOperation({ summary: 'Compile a function ' })
  @UseGuards(JwtAuthGuard, ApplicationAuthGuard)
  @Post(':name/compile')
  async compile(
    @Param('appid') appid: string,
    @Param('name') name: string,
    @Body() dto: CompileFunctionDto,
    @I18n() i18n: I18nContext<I18nTranslations>,
  ) {
    if (!dto.code) {
      return ResponseUtil.error(i18n.t('function.compile.codeRequired'))
    }

    const func = await this.functionsService.findOne(appid, name)
    if (!func) {
      throw new HttpException(
        i18n.t('function.common.notFound', { args: { name } }),
        HttpStatus.NOT_FOUND,
      )
    }

    const res = await this.functionsService.compile(func, dto)
    return ResponseUtil.ok(res)
  }

  /**
   * Get function history
   */
  @ApiResponseArray(CloudFunctionHistory)
  @ApiOperation({ summary: 'Get cloud function history' })
  @UseGuards(JwtAuthGuard, ApplicationAuthGuard)
  @Get(':name/history')
  async getHistory(
    @Param('appid') appid: string,
    @Param('name') name: string,
    @I18n() i18n: I18nContext<I18nTranslations>,
  ) {
    const func = await this.functionsService.findOne(appid, name)
    if (!func) {
      throw new HttpException(
        i18n.t('function.common.notFound', { args: { name } }),
        HttpStatus.NOT_FOUND,
      )
    }

    const res = await this.functionsService.getHistory(func)
    return ResponseUtil.ok(res)
  }

  // Simplified Runtime Management APIs for Shared Runtime

  /**
   * Deploy a function with dependency checking (enhanced deployment)
   */
  @ApiOperation({ summary: 'Deploy a function to shared runtime with dependency checking' })
  @UseGuards(JwtAuthGuard, ApplicationAuthGuard)
  @Post(':name/deploy')
  async deployFunction(
    @Param('appid') appid: string,
    @Param('name') name: string,
    @I18n() i18n: I18nContext<I18nTranslations>,
  ) {
    const func = await this.functionsService.findOne(appid, name)
    if (!func) {
      throw new HttpException(
        i18n.t('function.common.notFound', { args: { name } }),
        HttpStatus.NOT_FOUND,
      )
    }

    // Enhanced deployment with dependency checking
    const result = await this.functionRuntimeService.deployFunction(func._id.toString())
    return ResponseUtil.ok(result)
  }

  /**
   * Start a function (simple start without dependency checking)
   */
  @ApiOperation({ summary: 'Start a function in shared runtime' })
  @UseGuards(JwtAuthGuard, ApplicationAuthGuard)
  @Post(':name/start')
  async startFunction(
    @Param('appid') appid: string,
    @Param('name') name: string,
    @I18n() i18n: I18nContext<I18nTranslations>,
  ) {
    const func = await this.functionsService.findOne(appid, name)
    if (!func) {
      throw new HttpException(
        i18n.t('function.common.notFound', { args: { name } }),
        HttpStatus.NOT_FOUND,
      )
    }

    const result = await this.functionRuntimeService.startFunction(func._id.toString())
    return ResponseUtil.ok(result)
  }

  /**
   * Undeploy a function (set state to STOPPED)
   */
  @ApiOperation({ summary: 'Undeploy a function from shared runtime' })
  @UseGuards(JwtAuthGuard, ApplicationAuthGuard)
  @Post(':name/undeploy')
  async undeployFunction(
    @Param('appid') appid: string,
    @Param('name') name: string,
    @I18n() i18n: I18nContext<I18nTranslations>,
  ) {
    const func = await this.functionsService.findOne(appid, name)
    if (!func) {
      throw new HttpException(
        i18n.t('function.common.notFound', { args: { name } }),
        HttpStatus.NOT_FOUND,
      )
    }

    const result = await this.functionRuntimeService.stopFunction(func._id.toString())
    return ResponseUtil.ok(result)
  }

  /**
   * Get function deployment status
   */
  @ApiOperation({ summary: 'Get function deployment status' })
  @UseGuards(JwtAuthGuard, ApplicationAuthGuard)
  @Get(':name/status')
  async getFunctionStatus(
    @Param('appid') appid: string,
    @Param('name') name: string,
    @I18n() i18n: I18nContext<I18nTranslations>,
  ) {
    const func = await this.functionsService.findOne(appid, name)
    if (!func) {
      throw new HttpException(
        i18n.t('function.common.notFound', { args: { name } }),
        HttpStatus.NOT_FOUND,
      )
    }

    const result = await this.functionRuntimeService.getFunctionStatus(func._id.toString())
    return ResponseUtil.ok(result)
  }

  /**
   * Get shared runtime status
   */
  @ApiOperation({ summary: 'Get shared runtime status' })
  @UseGuards(JwtAuthGuard, ApplicationAuthGuard)
  @Get('runtime/status')
  async getSharedRuntimeStatus(@Param('appid') appid: string) {
    const sharedRuntimeStatus = this.functionRuntimeService.getSharedRuntimeStatus()
    const functionStatuses = await this.functionRuntimeService.getAllFunctionStatuses(appid)

    return ResponseUtil.ok({
      sharedRuntime: sharedRuntimeStatus,
      functions: functionStatuses
    })
  }

  // Batch Operations APIs

  /**
   * Batch deploy multiple functions
   */
  @ApiOperation({ summary: 'Batch deploy multiple functions with dependency checking' })
  @UseGuards(JwtAuthGuard, ApplicationAuthGuard)
  @Post('batch/deploy')
  async batchDeploy(
    @Param('appid') appid: string,
    @Body() request: BatchDeploymentRequest,
    @I18n() i18n: I18nContext<I18nTranslations>,
  ) {
    // Validate function IDs belong to the app
    const functions = await Promise.all(
      request.functionIds.map(id => this.functionsService.findById(id))
    )

    const invalidFunctions = functions.filter((func, index) =>
      !func || func.appid !== appid
    )

    if (invalidFunctions.length > 0) {
      return ResponseUtil.error('Some functions not found or do not belong to this app')
    }

    const result = await this.batchDeploymentService.batchDeploy(request)
    return ResponseUtil.ok(result)
  }

  /**
   * Batch stop multiple functions
   */
  @ApiOperation({ summary: 'Batch stop multiple functions' })
  @UseGuards(JwtAuthGuard, ApplicationAuthGuard)
  @Post('batch/stop')
  async batchStop(
    @Param('appid') appid: string,
    @Body() body: { functionIds: string[] },
    @I18n() i18n: I18nContext<I18nTranslations>,
  ) {
    const result = await this.batchDeploymentService.batchStop(body.functionIds)
    return ResponseUtil.ok(result)
  }

  /**
   * Batch restart multiple functions
   */
  @ApiOperation({ summary: 'Batch restart multiple functions' })
  @UseGuards(JwtAuthGuard, ApplicationAuthGuard)
  @Post('batch/restart')
  async batchRestart(
    @Param('appid') appid: string,
    @Body() body: { functionIds: string[] },
    @I18n() i18n: I18nContext<I18nTranslations>,
  ) {
    const result = await this.batchDeploymentService.batchRestart(body.functionIds)
    return ResponseUtil.ok(result)
  }

  /**
   * Get batch deployment recommendations
   */
  @ApiOperation({ summary: 'Get batch deployment recommendations' })
  @UseGuards(JwtAuthGuard, ApplicationAuthGuard)
  @Post('batch/recommendations')
  async getBatchRecommendations(
    @Param('appid') appid: string,
    @Body() body: { functionIds: string[] },
    @I18n() i18n: I18nContext<I18nTranslations>,
  ) {
    const result = await this.batchDeploymentService.getBatchDeploymentRecommendations(body.functionIds)
    return ResponseUtil.ok(result)
  }

  // Performance Monitoring APIs

  /**
   * Get function performance statistics
   */
  @ApiOperation({ summary: 'Get function performance statistics' })
  @UseGuards(JwtAuthGuard, ApplicationAuthGuard)
  @Get(':name/performance/stats')
  async getFunctionPerformanceStats(
    @Param('appid') appid: string,
    @Param('name') name: string,
    @I18n() i18n: I18nContext<I18nTranslations>,
  ) {
    const func = await this.functionsService.findOne(appid, name)
    if (!func) {
      throw new HttpException(
        i18n.t('function.common.notFound', { args: { name } }),
        HttpStatus.NOT_FOUND,
      )
    }

    const stats = this.performanceMonitorService.getFunctionStats(func._id.toString())
    return ResponseUtil.ok(stats)
  }

  /**
   * Get function performance trend
   */
  @ApiOperation({ summary: 'Get function performance trend' })
  @UseGuards(JwtAuthGuard, ApplicationAuthGuard)
  @Get(':name/performance/trend')
  async getFunctionPerformanceTrend(
    @Param('appid') appid: string,
    @Param('name') name: string,
    @Query('hours') hours?: number,
    @I18n() i18n?: I18nContext<I18nTranslations>,
  ) {
    const func = await this.functionsService.findOne(appid, name)
    if (!func) {
      throw new HttpException(
        i18n.t('function.common.notFound', { args: { name } }),
        HttpStatus.NOT_FOUND,
      )
    }

    const trend = this.performanceMonitorService.getPerformanceTrend(
      func._id.toString(),
      hours || 24
    )
    return ResponseUtil.ok(trend)
  }

  /**
   * Get all functions performance overview
   */
  @ApiOperation({ summary: 'Get all functions performance overview' })
  @UseGuards(JwtAuthGuard, ApplicationAuthGuard)
  @Get('performance/overview')
  async getPerformanceOverview(@Param('appid') appid: string) {
    const overview = this.performanceMonitorService.getSystemOverview()
    return ResponseUtil.ok(overview)
  }

  /**
   * Get all functions performance statistics
   */
  @ApiOperation({ summary: 'Get all functions performance statistics' })
  @UseGuards(JwtAuthGuard, ApplicationAuthGuard)
  @Get('performance/stats')
  async getAllPerformanceStats(@Param('appid') appid: string) {
    const stats = this.performanceMonitorService.getAllFunctionStats()
    // Filter by appid
    const appFunctions = await this.functionsService.findAll(appid)
    const appFunctionIds = new Set(appFunctions.map(f => f._id.toString()))

    const filteredStats = stats.filter(stat => appFunctionIds.has(stat.functionId))
    return ResponseUtil.ok(filteredStats)
  }

  // Cache Management APIs

  /**
   * Warm up function cache
   */
  @ApiOperation({ summary: 'Warm up function cache' })
  @UseGuards(JwtAuthGuard, ApplicationAuthGuard)
  @Post('cache/warmup')
  async warmupCache(@Param('appid') appid: string) {
    await this.functionRuntimeService.warmupCache(appid)
    return ResponseUtil.ok({ message: 'Cache warmed up successfully' })
  }

  /**
   * Clear function cache
   */
  @ApiOperation({ summary: 'Clear function cache' })
  @UseGuards(JwtAuthGuard, ApplicationAuthGuard)
  @Delete('cache')
  async clearCache(
    @Param('appid') appid: string,
    @Query('functionId') functionId?: string
  ) {
    if (functionId) {
      this.functionRuntimeService.clearCache(functionId)
    } else {
      // Clear cache for all functions in the app
      this.functionCacheService.invalidateFunctionsByAppId(appid)
    }
    return ResponseUtil.ok({ message: 'Cache cleared successfully' })
  }

  /**
   * Get cache statistics
   */
  @ApiOperation({ summary: 'Get cache statistics' })
  @UseGuards(JwtAuthGuard, ApplicationAuthGuard)
  @Get('cache/stats')
  async getCacheStats(@Param('appid') appid: string) {
    const stats = this.functionCacheService.getCacheStats()
    return ResponseUtil.ok(stats)
  }

  /**
   * Get hot functions (most accessed)
   */
  @ApiOperation({ summary: 'Get hot functions (most accessed)' })
  @UseGuards(JwtAuthGuard, ApplicationAuthGuard)
  @Get('cache/hot')
  async getHotFunctions(
    @Param('appid') appid: string,
    @Query('limit') limit?: number
  ) {
    const hotFunctions = this.functionRuntimeService.getHotFunctions(limit || 10)
    // Filter by appid
    const filteredHotFunctions = hotFunctions.filter(item => item.function.appid === appid)
    return ResponseUtil.ok(filteredHotFunctions)
  }
}
