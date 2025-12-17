import { Injectable, Logger } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import { isConditionTrue } from '../utils/getter'
import { InstanceService } from './instance.service'
import { ServerConfig, TASK_LOCK_INIT_TIME } from 'src/constants'
import { SystemDatabase } from 'src/system-database'
import {
  Application,
  ApplicationPhase,
  ApplicationState,
} from 'src/application/entities/application'
import { DomainState, RuntimeDomain } from 'src/gateway/entities/runtime-domain'
import { BucketDomain } from 'src/gateway/entities/bucket-domain'
import { WebsiteHosting } from 'src/website/entities/website'
import { CronTrigger, TriggerState } from 'src/trigger/entities/cron-trigger'
import { DedicatedDatabaseService } from 'src/database/dedicated-database/dedicated-database.service'
import {
  DedicatedDatabase,
  DedicatedDatabasePhase,
  DedicatedDatabaseState,
} from 'src/database/entities/dedicated-database'
import { Setting, SettingKey } from 'src/setting/entities/setting'

@Injectable()
export class InstanceTaskService {
  readonly lockTimeout = 15 // in second
  private readonly logger = new Logger(InstanceTaskService.name)

  constructor(
    private readonly instanceService: InstanceService,
    private readonly dedicatedDatabaseService: DedicatedDatabaseService,
  ) { }

  @Cron(CronExpression.EVERY_SECOND)
  async tick() {
    if (ServerConfig.DISABLED_INSTANCE_TASK) {
      return
    }

    // Phase `Created` | `Stopped` ->  `Starting`
    this.handleRunningState().catch((err) => {
      this.logger.error('handleRunningState error', err)
      this.logger.debug(err?.response?.toJSON() || JSON.stringify(err))
    })

    // Phase `Starting` -> `Started`
    this.handleStartingPhase().catch((err) => {
      this.logger.error('handleStartingPhase error', err)
      this.logger.debug(err?.response?.toJSON() || JSON.stringify(err))
    })

    // Phase `Started` -> `Stopping`
    this.handleStoppedState().catch((err) => {
      this.logger.error('handleStoppedState error', err)
      this.logger.debug(err?.response?.toJSON() || JSON.stringify(err))
    })

    // Phase `Stopping` -> `Stopped`
    this.handleStoppingPhase().catch((err) => {
      this.logger.error('handleStoppingPhase error', err)
      this.logger.debug(err?.response?.toJSON() || JSON.stringify(err))
    })

    // Phase `Started` -> `Starting`
    this.handleRestartingState().catch((err) => {
      this.logger.error('handleRestartingPhase error', err)
      this.logger.debug(err?.response?.toJSON() || JSON.stringify(err))
    })
  }

  /**
   * State `Running`:
   * - move phase `Stopped` to `Starting` (but NOT `Created` - let ApplicationTaskService handle that)
   */
  async handleRunningState() {
    const db = SystemDatabase.db

    // Only handle Stopped -> Starting transition
    // ApplicationTaskService handles Created -> Starting transition
    await db.collection<Application>('Application').updateMany(
      {
        state: ApplicationState.Running,
        phase: ApplicationPhase.Stopped,
        lockedAt: { $lt: new Date(Date.now() - 1000 * this.lockTimeout) },
      },
      {
        $set: {
          phase: ApplicationPhase.Starting,
          lockedAt: TASK_LOCK_INIT_TIME,
          updatedAt: new Date(),
        },
      },
    )
  }

  /**
   * Phase `Starting`:
   * - waiting for instance to be available
   * - move phase to `Started`
   */
  async handleStartingPhase() {
    const db = SystemDatabase.db

    const appCreateTimeConf = await db.collection<Setting>('Setting').findOne({
      key: SettingKey.AppCreateTimeOut,
      public: false,
    })

    const res = await db
      .collection<Application>('Application')
      .findOneAndUpdate(
        {
          phase: ApplicationPhase.Starting,
          lockedAt: { $lt: new Date(Date.now() - 1000 * this.lockTimeout) },
        },
        { $set: { lockedAt: new Date() } },
        { sort: { lockedAt: 1, updatedAt: 1 }, returnDocument: 'after' },
      )

    if (!res.value) return
    const app = res.value

    // if waiting time is more than 5 minutes, stop the application
    const waitingTime = Date.now() - app.updatedAt.getTime()

    // if waiting time is more than 10 minutes, stop the application
    if (appCreateTimeConf?.value) {
      const appCreateTimeOut = parseInt(appCreateTimeConf.value) * 60 * 1000

      if (waitingTime > appCreateTimeOut) {
        await db.collection<Application>('Application').updateOne(
          { appid: app.appid },
          {
            $set: {
              state: ApplicationState.Stopped,
              phase: ApplicationPhase.Stopping,
              lockedAt: TASK_LOCK_INIT_TIME,
              updatedAt: new Date(),
            },
          },
        )

        await db
          .collection<DedicatedDatabase>('DedicatedDatabase')
          .findOneAndUpdate(
            {
              appid: app.appid,
            },
            {
              $set: {
                state: DedicatedDatabaseState.Stopped,
                phase: DedicatedDatabasePhase.Stopping,
              },
            },
          )

        this.logger.log(`${app.appid} updated to state Stopped due to timeout`)
        return
      }
    }

    const appid = app.appid

    const ddb = await this.dedicatedDatabaseService.findOne(appid)

    if (ddb) {
      if (
        ddb.phase !== DedicatedDatabasePhase.Started ||
        ddb.state !== DedicatedDatabaseState.Running
      ) {
        await this.relock(appid, waitingTime)
        return
      }
    }

    // create instance (in shared runtime mode, this ensures shared runtime is running)
    await this.instanceService.create(app.appid)

    const instance = await this.instanceService.get(appid)

    // In shared runtime mode, we check if the shared runtime is available
    // instead of checking individual deployment status
    if (!instance.deployment || !instance.service) {
      // Shared runtime is not available, relock and try again
      await this.relock(appid, waitingTime)
      return
    }

    // active runtime domain
    await db
      .collection<RuntimeDomain>('RuntimeDomain')
      .updateOne(
        { appid, state: DomainState.Inactive },
        { $set: { state: DomainState.Active, updatedAt: new Date() } },
      )

    // active website domain
    await db
      .collection<WebsiteHosting>('WebsiteHosting')
      .updateMany(
        { appid, state: DomainState.Inactive },
        { $set: { state: DomainState.Active, updatedAt: new Date() } },
      )

    // active bucket domain
    await db
      .collection<BucketDomain>('BucketDomain')
      .updateMany(
        { appid, state: DomainState.Inactive },
        { $set: { state: DomainState.Active, updatedAt: new Date() } },
      )

    // active triggers if any
    await db
      .collection<CronTrigger>('CronTrigger')
      .updateMany(
        { appid, state: TriggerState.Inactive },
        { $set: { state: TriggerState.Active, updatedAt: new Date() } },
      )

    // Determine the target state based on current state
    let toState = app.state
    if (app.state === ApplicationState.Restarting) {
      toState = ApplicationState.Running
    } else if (!app.state || app.state === ApplicationState.Stopped) {
      // If no state is set or it's stopped, set it to Running
      toState = ApplicationState.Running
    }

    // update application state
    await db.collection<Application>('Application').updateOne(
      { appid, phase: ApplicationPhase.Starting },
      {
        $set: {
          state: toState,
          phase: ApplicationPhase.Started,
          lockedAt: TASK_LOCK_INIT_TIME,
          updatedAt: new Date(),
        },
      },
    )

    this.logger.debug(`Application ${app.appid} updated to phase started`)
  }

  /**
   * State `Stopped`:
   * - move phase `Started` to `Stopping`
   */
  async handleStoppedState() {
    const db = SystemDatabase.db

    await db.collection<Application>('Application').updateMany(
      {
        state: ApplicationState.Stopped,
        phase: ApplicationPhase.Started,
        lockedAt: { $lt: new Date(Date.now() - 1000 * this.lockTimeout) },
      },
      {
        $set: {
          lockedAt: TASK_LOCK_INIT_TIME,
          phase: ApplicationPhase.Stopping,
          updatedAt: new Date(),
        },
      },
    )
  }

  /**
   * Phase `Stopping`:
   * - waiting for instance to be removed
   * - move phase `Stopping` to `Stopped`
   */
  async handleStoppingPhase() {
    const db = SystemDatabase.db

    const res = await db
      .collection<Application>('Application')
      .findOneAndUpdate(
        {
          phase: ApplicationPhase.Stopping,
          lockedAt: { $lt: new Date(Date.now() - 1000 * this.lockTimeout) },
        },
        { $set: { lockedAt: new Date() } },
        { sort: { lockedAt: 1, updatedAt: 1 }, returnDocument: 'after' },
      )

    if (!res.value) return
    const app = res.value
    const appid = app.appid

    const waitingTime = Date.now() - app.updatedAt.getTime()

    // inactive runtime domain
    await db
      .collection<RuntimeDomain>('RuntimeDomain')
      .updateOne(
        { appid, state: DomainState.Active },
        { $set: { state: DomainState.Inactive, updatedAt: new Date() } },
      )

    // inactive website domain
    await db
      .collection<WebsiteHosting>('WebsiteHosting')
      .updateMany(
        { appid, state: DomainState.Active },
        { $set: { state: DomainState.Inactive, updatedAt: new Date() } },
      )

    // inactive bucket domain
    await db
      .collection<BucketDomain>('BucketDomain')
      .updateMany(
        { appid, state: DomainState.Active },
        { $set: { state: DomainState.Inactive, updatedAt: new Date() } },
      )

    // inactive triggers if any
    await db
      .collection<CronTrigger>('CronTrigger')
      .updateMany(
        { appid, state: TriggerState.Active },
        { $set: { state: TriggerState.Inactive, updatedAt: new Date() } },
      )

    // In shared runtime mode, we don't need to wait for individual instances to be removed
    // The shared runtime continues running and handles app lifecycle internally
    await this.instanceService.remove(app.appid)

    const ddb = await this.dedicatedDatabaseService.findOne(appid)

    if (ddb) {
      if (
        ddb.phase !== DedicatedDatabasePhase.Stopped ||
        ddb.state !== DedicatedDatabaseState.Stopped
      ) {
        await this.relock(appid, waitingTime)
        return
      }
    }

    // update application phase to `Stopped`
    await db.collection<Application>('Application').updateOne(
      { appid, phase: ApplicationPhase.Stopping },
      {
        $set: {
          phase: ApplicationPhase.Stopped,
          lockedAt: TASK_LOCK_INIT_TIME,
          updatedAt: new Date(),
        },
      },
    )

    this.logger.log(`Application ${app.appid} updated to phase Stopped`)
  }

  /**
   * State `Restarting`:
   * - move phase `Started` to `Starting`
   */
  async handleRestartingState() {
    const db = SystemDatabase.db

    const res = await db
      .collection<Application>('Application')
      .findOneAndUpdate(
        {
          state: ApplicationState.Restarting,
          phase: ApplicationPhase.Started,
          lockedAt: { $lt: new Date(Date.now() - 1000 * this.lockTimeout) },
        },
        { $set: { lockedAt: new Date() } },
        { sort: { lockedAt: 1, updatedAt: 1 }, returnDocument: 'after' },
      )

    if (!res.value) return
    const app = res.value

    await this.instanceService.restart(app.appid)

    // update application phase to `Starting`
    await db.collection<Application>('Application').updateOne(
      {
        appid: app.appid,
      },
      {
        $set: {
          phase: ApplicationPhase.Starting,
          lockedAt: TASK_LOCK_INIT_TIME,
          updatedAt: new Date(),
        },
      },
    )

    this.logger.log(`Application ${app.appid} updated to phase Starting`)
  }

  /**
   * Relock application by appid, lockedTime is in milliseconds
   */
  async relock(appid: string, lockedTime = 0) {
    if (lockedTime <= 2 * 60 * 1000) {
      lockedTime = Math.ceil(lockedTime / 10)
    }

    if (lockedTime > 2 * 60 * 1000) {
      lockedTime = this.lockTimeout * 1000
    }

    const db = SystemDatabase.db
    const lockedAt = new Date(Date.now() - 1000 * this.lockTimeout + lockedTime)
    await db
      .collection<Application>('Application')
      .updateOne({ appid: appid }, { $set: { lockedAt } })
  }

  private getHourTime() {
    const latestTime = new Date()
    latestTime.setMinutes(0)
    latestTime.setSeconds(0)
    latestTime.setMilliseconds(0)
    latestTime.setHours(latestTime.getHours())
    return latestTime
  }
}
