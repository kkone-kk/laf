import {
  Body,
  Controller,
  Delete,
  Get,
  Logger,
  Param,
  ParseArrayPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common'
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger'
import { ApplicationAuthGuard } from 'src/authentication/application.auth.guard'
import { JwtAuthGuard } from 'src/authentication/jwt.auth.guard'
import { ResponseUtil } from 'src/utils/response'
import { EnvironmentVariableService } from './environment.service'
import { CreateEnvironmentDto } from './dto/create-env.dto'
import { APPLICATION_SECRET_KEY } from 'src/constants'
import { ProcessManagerService } from 'src/local-cluster/process-manager.service'

@ApiTags('Application')
@ApiBearerAuth('Authorization')
@Controller('apps/:appid/environments')
export class EnvironmentVariableController {
  private readonly logger = new Logger(EnvironmentVariableController.name)

  constructor(
    private readonly confService: EnvironmentVariableService,
    private readonly processManager: ProcessManagerService,
  ) {}

  /**
   * Update environment variables (replace all)
   * @param appid
   * @param dto
   * @returns
   */
  @ApiResponse({ type: ResponseUtil })
  @ApiOperation({ summary: 'Update environment variables (replace all)' })
  @UseGuards(JwtAuthGuard, ApplicationAuthGuard)
  @Post()
  @ApiBody({
    type: [CreateEnvironmentDto],
    description: 'The environment variables',
  })
  async updateAll(
    @Param('appid') appid: string,
    @Body(new ParseArrayPipe({ items: CreateEnvironmentDto, whitelist: true }))
    dto: CreateEnvironmentDto[],
  ) {
    // app secret can not missing or empty
    const secret = dto.find((item) => item.name === APPLICATION_SECRET_KEY)
    if (!secret || !secret.value) {
      return ResponseUtil.error(APPLICATION_SECRET_KEY + ' can not be empty')
    }

    const res = await this.confService.updateAll(appid, dto)

    // Reload process with new envs if running
    if (this.processManager.getProcess(appid)) {
      const envObj = dto.reduce((acc, cur) => ({ ...acc, [cur.name]: cur.value }), {})
      await this.processManager.reloadProcess(appid, envObj)
    }

    return ResponseUtil.ok(res)
  }

  /**
   * Set a environment variable
   * @param appid
   * @param dto
   * @returns
   */
  @ApiResponse({ type: ResponseUtil })
  @ApiOperation({ summary: 'Set a environment variable (create/update)' })
  @UseGuards(JwtAuthGuard, ApplicationAuthGuard)
  @Patch()
  async add(@Param('appid') appid: string, @Body() dto: CreateEnvironmentDto) {
    // can not set empty app secret
    if (dto.name === APPLICATION_SECRET_KEY && !dto.value) {
      return ResponseUtil.error(APPLICATION_SECRET_KEY + ' can not be empty')
    }

    const res = await this.confService.setOne(appid, dto)

     // Reload process with new envs if running
    if (this.processManager.getProcess(appid)) {
      const envs = await this.confService.findAll(appid)
      const envObj = envs.reduce((acc, cur) => ({ ...acc, [cur.name]: cur.value }), {})
      await this.processManager.reloadProcess(appid, envObj)
    }

    return ResponseUtil.ok(res)
  }

  /**
   * Get environment variables
   * @param appid
   * @returns
   */
  @ApiResponse({ type: ResponseUtil })
  @ApiOperation({ summary: 'Get environment variables' })
  @UseGuards(JwtAuthGuard, ApplicationAuthGuard)
  @Get()
  async get(@Param('appid') appid: string) {
    const res = await this.confService.findAll(appid)
    return ResponseUtil.ok(res)
  }

  /**
   * Delete an environment variable by name
   * @param appid
   * @param name
   * @returns
   */
  @ApiResponse({ type: ResponseUtil })
  @ApiOperation({ summary: 'Delete an environment variable by name' })
  @UseGuards(JwtAuthGuard, ApplicationAuthGuard)
  @Delete(':name')
  async delete(@Param('appid') appid: string, @Param('name') name: string) {
    // can not delete secret key
    if (name === APPLICATION_SECRET_KEY) {
      return ResponseUtil.error(APPLICATION_SECRET_KEY + ' can not be deleted')
    }

    const res = await this.confService.deleteOne(appid, name)

    // Reload process with new envs if running
    if (this.processManager.getProcess(appid)) {
      const envs = await this.confService.findAll(appid)
      const envObj = envs.reduce((acc, cur) => ({ ...acc, [cur.name]: cur.value }), {})
      await this.processManager.reloadProcess(appid, envObj)
    }

    return ResponseUtil.ok(res)
  }
}
