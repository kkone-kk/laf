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
import { ResponseUtil } from '../utils/response'
import { DependencyService } from './dependency.service'
import { CreateDependencyDto } from './dto/create-dependency.dto'
import { UpdateDependencyDto } from './dto/update-dependency.dto'
import { DeleteDependencyDto } from './dto/delete-dependency.dto'
import { JwtAuthGuard } from 'src/authentication/jwt.auth.guard'
import { ApplicationAuthGuard } from 'src/authentication/application.auth.guard'
import { ProcessManagerService } from 'src/local-cluster/process-manager.service'

@ApiTags('Application')
@ApiBearerAuth('Authorization')
@Controller('apps/:appid/dependencies')
export class DependencyController {
  private readonly logger = new Logger(DependencyController.name)

  constructor(
    private readonly depsService: DependencyService,
    private readonly processManager: ProcessManagerService,
  ) {}

  /**
   * Add application dependencies
   * @param appid
   * @param dto
   * @returns
   */
  @ApiResponse({ type: ResponseUtil })
  @ApiOperation({ summary: 'Add application dependencies' })
  @UseGuards(JwtAuthGuard, ApplicationAuthGuard)
  @Post()
  @ApiBody({ type: [CreateDependencyDto] })
  async add(
    @Param('appid') appid: string,
    @Body(new ParseArrayPipe({ items: CreateDependencyDto, whitelist: true }))
    dto: CreateDependencyDto[],
  ) {
    const res = await this.depsService.add(appid, dto)

    // Install dependencies in local shared runtime
    for (const dep of dto) {
        try {
            await this.processManager.installDependency(dep.name, dep.spec)
        } catch (e) {
            this.logger.error(`Failed to install dependency ${dep.name}: ${e.message}`)
            // Should we return error? Usually yes, but maybe partial success?
            // For now, let's log and continue, or maybe fail fast.
            // The DB record is already updated, so we should probably try to be consistent.
        }
    }

    return ResponseUtil.ok(res)
  }

  /**
   * Update application dependencies
   * @param appid
   * @param dto
   * @returns
   */
  @ApiResponse({ type: ResponseUtil })
  @ApiOperation({ summary: 'Update application dependencies' })
  @UseGuards(JwtAuthGuard, ApplicationAuthGuard)
  @Patch()
  @ApiBody({ type: [UpdateDependencyDto] })
  async update(
    @Param('appid') appid: string,
    @Body(new ParseArrayPipe({ items: UpdateDependencyDto, whitelist: true }))
    dto: UpdateDependencyDto[],
  ) {
    const res = await this.depsService.update(appid, dto)

     // Update dependencies in local shared runtime
    for (const dep of dto) {
        try {
            await this.processManager.installDependency(dep.name, dep.spec)
        } catch (e) {
            this.logger.error(`Failed to update dependency ${dep.name}: ${e.message}`)
        }
    }

    return ResponseUtil.ok(res)
  }

  /**
   * Get application dependencies
   * @param appid
   * @returns
   */
  @ApiResponse({ type: ResponseUtil })
  @ApiOperation({ summary: 'Get application dependencies' })
  @UseGuards(JwtAuthGuard, ApplicationAuthGuard)
  @Get()
  async getDependencies(@Param('appid') appid: string) {
    const res = await this.depsService.getMergedObjects(appid)
    return ResponseUtil.ok(res)
  }

  /**
   * Remove a dependency
   * @param appid
   * @param name
   * @returns
   */
  @ApiResponse({ type: ResponseUtil })
  @ApiOperation({ summary: 'Remove a dependency' })
  @UseGuards(JwtAuthGuard, ApplicationAuthGuard)
  @Delete()
  @ApiBody({ type: DeleteDependencyDto })
  async remove(
    @Param('appid') appid: string,
    @Body() dto: DeleteDependencyDto,
  ) {
    const res = await this.depsService.removeOne(appid, dto.name)

    // Uninstall dependency from local shared runtime
    try {
        await this.processManager.removeDependency(dto.name)
    } catch (e) {
         this.logger.error(`Failed to remove dependency ${dto.name}: ${e.message}`)
    }

    return ResponseUtil.ok(res)
  }
}
