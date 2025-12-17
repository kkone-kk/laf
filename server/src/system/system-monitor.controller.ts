import { Controller, Get, UseGuards } from '@nestjs/common'
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import { JwtAuthGuard } from 'src/authentication/jwt.auth.guard'
import { PerformanceMonitorService, SystemHealth } from 'src/utils/performance-monitor.service'
import { ProcessManagerService, RuntimeHealth } from 'src/local-cluster/process-manager.service'
import { SmartLoggerService } from 'src/utils/smart-logger.service'

@ApiTags('System Monitor')
@Controller('system')
@UseGuards(JwtAuthGuard)
export class SystemMonitorController {
  constructor(
    private readonly performanceMonitor: PerformanceMonitorService,
    private readonly processManager: ProcessManagerService,
    private readonly smartLogger: SmartLoggerService,
  ) { }

  @Get('health')
  @ApiOperation({ summary: 'Get system health status' })
  @ApiResponse({ status: 200, description: 'System health information' })
  async getSystemHealth(): Promise<SystemHealth> {
    return this.performanceMonitor.getSystemHealth()
  }

  @Get('runtime/health')
  @ApiOperation({ summary: 'Get shared runtime health status' })
  @ApiResponse({ status: 200, description: 'Runtime health information' })
  async getRuntimeHealth(): Promise<RuntimeHealth> {
    return this.processManager.getRuntimeHealth()
  }

  @Get('runtime/info')
  @ApiOperation({ summary: 'Get shared runtime information' })
  @ApiResponse({ status: 200, description: 'Runtime information' })
  async getRuntimeInfo() {
    return this.processManager.getSharedRuntimeInfo()
  }

  @Get('performance/metrics')
  @ApiOperation({ summary: 'Get performance metrics history' })
  @ApiResponse({ status: 200, description: 'Performance metrics data' })
  async getPerformanceMetrics() {
    return {
      history: this.performanceMonitor.getMetricsHistory(),
      loggerMetrics: this.smartLogger.getPerformanceMetrics()
    }
  }

  @Get('status')
  @ApiOperation({ summary: 'Get comprehensive system status' })
  @ApiResponse({ status: 200, description: 'Complete system status' })
  async getSystemStatus() {
    const [systemHealth, runtimeHealth, runtimeInfo] = await Promise.all([
      this.performanceMonitor.getSystemHealth(),
      this.processManager.getRuntimeHealth(),
      this.processManager.getSharedRuntimeInfo()
    ])

    return {
      timestamp: new Date(),
      system: systemHealth,
      runtime: {
        health: runtimeHealth,
        info: runtimeInfo
      },
      performance: {
        metrics: this.performanceMonitor.getMetricsHistory().slice(-10), // Last 10 entries
        loggerMetrics: this.smartLogger.getPerformanceMetrics()
      }
    }
  }
}