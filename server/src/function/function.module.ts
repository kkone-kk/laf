import { Module, forwardRef } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { EventEmitterModule } from '@nestjs/event-emitter'
import { FunctionController } from './function.controller'
import { FunctionService } from './function.service'
import { FunctionRuntimeService } from './function-runtime.service'
import { DependencyCheckerService } from './dependency-checker.service'
import { FunctionCacheService } from './function-cache.service'
import { PerformanceMonitorService } from './performance-monitor.service'
import { BatchDeploymentService } from './batch-deployment.service'
import { DatabaseModule } from 'src/database/database.module'
import { TriggerService } from 'src/trigger/trigger.service'
import { FunctionRecycleBinService } from 'src/recycle-bin/cloud-function/function-recycle-bin.service'
import { HttpModule } from '@nestjs/axios'
import { ApplicationModule } from 'src/application/application.module'
import { LocalClusterModule } from 'src/local-cluster/local-cluster.module'

@Module({
  imports: [
    forwardRef(() => ApplicationModule),
    DatabaseModule,
    HttpModule,
    LocalClusterModule,
    EventEmitterModule.forRoot(),
  ],
  controllers: [FunctionController],
  providers: [
    FunctionService,
    FunctionRuntimeService,
    DependencyCheckerService,
    FunctionCacheService,
    PerformanceMonitorService,
    BatchDeploymentService,
    FunctionRecycleBinService,
    JwtService,
    TriggerService,
  ],
  exports: [
    FunctionService,
    FunctionRuntimeService,
    DependencyCheckerService,
    FunctionCacheService,
    PerformanceMonitorService,
    BatchDeploymentService,
  ],
})
export class FunctionModule { }
