import { Module } from '@nestjs/common'
import { SystemMonitorController } from './system-monitor.controller'
import { PerformanceMonitorService } from 'src/utils/performance-monitor.service'
import { SmartLoggerService } from 'src/utils/smart-logger.service'
import { LocalClusterModule } from 'src/local-cluster/local-cluster.module'

@Module({
  imports: [LocalClusterModule],
  controllers: [SystemMonitorController],
  providers: [
    PerformanceMonitorService,
    SmartLoggerService,
  ],
  exports: [
    PerformanceMonitorService,
    SmartLoggerService,
  ],
})
export class SystemModule { }