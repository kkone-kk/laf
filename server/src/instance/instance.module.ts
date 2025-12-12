import { Module } from '@nestjs/common'
import { InstanceService } from './instance.service'
import { InstanceTaskService } from './instance-task.service'
import { StorageModule } from '../storage/storage.module'
import { DatabaseModule } from '../database/database.module'
import { ApplicationModule } from 'src/application/application.module'
import { JwtService } from '@nestjs/jwt'
import { LocalClusterModule } from 'src/local-cluster/local-cluster.module'
import { DedicatedDatabaseService } from 'src/database/dedicated-database/dedicated-database.service'

@Module({
  imports: [StorageModule, DatabaseModule, ApplicationModule, LocalClusterModule],
  providers: [InstanceService, InstanceTaskService, JwtService, DedicatedDatabaseService],
  exports: [InstanceService]
})
export class InstanceModule {}
