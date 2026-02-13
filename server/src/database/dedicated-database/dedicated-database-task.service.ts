import { Cron, CronExpression } from '@nestjs/schedule'
import { SystemDatabase } from 'src/system-database'
import {
  DedicatedDatabase,
  DedicatedDatabasePhase,
  DedicatedDatabaseState,
} from '../entities/dedicated-database'
import { DedicatedDatabaseService } from './dedicated-database.service'
import { ServerConfig, TASK_LOCK_INIT_TIME } from 'src/constants'
import { Injectable, Logger } from '@nestjs/common'
import { RegionService } from 'src/region/region.service'

@Injectable()
export class DedicatedDatabaseTaskService {
  private readonly logger = new Logger(DedicatedDatabaseTaskService.name)
  private readonly lockTimeout = 15 // in seconds
  private readonly db = SystemDatabase.db

  constructor(
    private readonly regionService: RegionService,
    private readonly dbService: DedicatedDatabaseService,
  ) {}

  @Cron(CronExpression.EVERY_SECOND)
  async tick() {
    // In local mode, we generally don't need complex tasks for dedicated database management
    // as we are not managing K8s resources.
    // However, we might want to ensure state transitions happen if the user requests them.
    // For now, we'll just mock it or keep it minimal.
  }

  async relock(appid: string, lockedTime = 0) {
      // Mock
  }
}
