import {
  Controller,
  Get,
  Logger,
  Param,
  Query,
  UseGuards,
  Sse,
  MessageEvent,
} from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger'
import { FunctionService } from '../function/function.service'
import { ApiResponsePagination, ResponseUtil } from '../utils/response'
import { FunctionLog } from './entities/function-log'
import { JwtAuthGuard } from 'src/authentication/jwt.auth.guard'
import { ApplicationAuthGuard } from 'src/authentication/application.auth.guard'
import { PassThrough } from 'nodemailer/lib/xoauth2'
import { Observable } from 'rxjs'
import { PodService } from 'src/application/pod.service'
import { ProcessManagerService } from 'src/local-cluster/process-manager.service'

@ApiBearerAuth('Authorization')
@Controller('apps/:appid/logs')
export class LogController {
  private readonly logger = new Logger(LogController.name)

  constructor(
    private readonly funcService: FunctionService,
    private readonly podService: PodService,
    private readonly processManager: ProcessManagerService
  ) {}

  /**
   * Get function logs
   * @param appid
   * @param name
   * @returns
   */
  @ApiTags('Function')
  @ApiOperation({ summary: 'Get function logs' })
  @ApiResponsePagination(FunctionLog)
  @UseGuards(JwtAuthGuard, ApplicationAuthGuard)
  @ApiQuery({
    name: 'functionName',
    type: String,
    description: 'The function name. Optional',
    required: false,
  })
  @ApiQuery({
    name: 'requestId',
    type: String,
    description: 'The request id. Optional',
    required: false,
  })
  @ApiQuery({
    name: 'page',
    type: String,
    description: 'The page number, default is 1',
    required: false,
  })
  @ApiQuery({
    name: 'pageSize',
    type: String,
    description: 'The page size, default is 10',
    required: false,
  })
  @Get('functions')
  async getLogs(
    @Param('appid') appid: string,
    @Query('requestId') requestId?: string,
    @Query('functionName') functionName?: string,
    @Query('pageSize') pageSize?: number,
    @Query('page') page?: number,
  ) {
    page = page || 1
    pageSize = pageSize || 10

    const res = await this.funcService.getLogs(appid, {
      requestId,
      functionName,
      pageSize: pageSize,
      page,
    })

    return ResponseUtil.ok({
      list: res.data,
      total: res.total,
      page,
      limit: pageSize, // @deprecated use pageSize instead
      pageSize: pageSize,
    })
  }

  @ApiTags('Application')
  @ApiOperation({ summary: 'Get app pod logs' })
  @UseGuards(JwtAuthGuard, ApplicationAuthGuard)
  @Sse(':podName')
  async streamLogs(
    @Param('podName') podName: string,
    @Query('containerName') containerName: string,
    @Param('appid') appid: string,
  ): Promise<Observable<MessageEvent>> {
      // Mocking logs for now since we are just spawning processes.
      // We could pipe stdout/stderr from ProcessManagerService if we kept the stream.
      // But ProcessManagerService uses 'inherit' for stdio, so it goes to console.
      // To support this, we would need to change ProcessManagerService to pipe stdio and buffer it or expose it.

      return new Observable<MessageEvent>((subscriber) => {
          subscriber.next({
              data: 'Logs are being redirected to the main console in local mode.',
              type: 'log',
              id: '1'
          })
          // subscriber.complete() // Keep open?
      })
  }
}
