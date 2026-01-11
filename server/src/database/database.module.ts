import { Module } from '@nestjs/common'
import { CollectionService } from './collection/collection.service'
import { CollectionController } from './collection/collection.controller'
import { PolicyController } from './policy/policy.controller'
import { PolicyService } from './policy/policy.service'
import { DatabaseService } from './database.service'
import { DatabaseController } from './database.controller'
import { PolicyRuleService } from './policy/policy-rule.service'
import { PolicyRuleController } from './policy/policy-rule.controller'
import { MongoService } from './mongo.service'
import { ApplicationService } from 'src/application/application.service'
import { BundleService } from 'src/application/bundle.service'
import { DatabaseUsageLimitTaskService } from './database-usage-limit-task.service'
import { DatabaseUsageCaptureTaskService } from './database-usage-capture-task.service'
import { SettingService } from 'src/setting/setting.service'
import { DedicatedDatabaseService } from './dedicated-database/dedicated-database.service'
import { DedicatedDatabaseTaskService } from './dedicated-database/dedicated-database-task.service'
import { HttpModule } from '@nestjs/axios'
import { ApplicationListener } from './listeners/application.listener'
@Module({
  imports: [HttpModule],
  controllers: [
    CollectionController,
    PolicyController,
    DatabaseController,
    PolicyRuleController,
  ],
  providers: [
    CollectionService,
    PolicyService,
    DatabaseService,
    PolicyRuleService,
    MongoService,
    ApplicationService,
    BundleService,
    DatabaseUsageCaptureTaskService,
    DatabaseUsageLimitTaskService,
    SettingService,
    DedicatedDatabaseService,
    DedicatedDatabaseTaskService,
    ApplicationListener,
  ],
  exports: [
    CollectionService,
    PolicyService,
    DatabaseService,
    PolicyRuleService,
    MongoService,
    DedicatedDatabaseService,
  ],
})
export class DatabaseModule {}
