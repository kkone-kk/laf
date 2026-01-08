import { Module } from '@nestjs/common'
import { ApplicationController } from './application.controller'
import { ApplicationService } from './application.service'
import { ApplicationTaskService } from './application-task.service'
import { InstanceService } from '../instance/instance.service'
import { JwtService } from '@nestjs/jwt'
import { FunctionService } from '../function/function.service'
import { EnvironmentVariableService } from './environment.service'
import { EnvironmentVariableController } from './environment.controller'
import { StorageModule } from '../storage/storage.module'
import { DatabaseModule } from 'src/database/database.module'
import { GatewayModule } from 'src/gateway/gateway.module'
import { ApplicationConfigurationService } from './configuration.service'
import { TriggerService } from 'src/trigger/trigger.service'
import { BundleService } from './bundle.service'
import { HttpModule } from '@nestjs/axios'
import { SettingService } from 'src/setting/setting.service'
import { PodService } from './pod.service'
import { PodController } from './pod.controller'

@Module({
  imports: [StorageModule, DatabaseModule, GatewayModule, HttpModule],
  controllers: [
    ApplicationController,
    EnvironmentVariableController,
    PodController,
  ],
  providers: [
    ApplicationService,
    ApplicationTaskService,
    InstanceService,
    JwtService,
    FunctionService,
    EnvironmentVariableService,
    ApplicationConfigurationService,
    TriggerService,
    BundleService,
    SettingService,
    PodService,
  ],
  exports: [
    ApplicationService,
    ApplicationConfigurationService,
    EnvironmentVariableService,
    BundleService,
    PodService,
  ],
})
export class ApplicationModule {}
