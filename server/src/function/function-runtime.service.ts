import { Injectable, Logger } from '@nestjs/common'
import { ProcessManagerService, SharedRuntimeInfo } from 'src/local-cluster/process-manager.service'
import { FunctionService } from './function.service'
import { FunctionState } from './entities/cloud-function'
import { DependencyCheckerService, DependencyCheckResult } from './dependency-checker.service'
import { FunctionCacheService } from './function-cache.service'
import { PerformanceMonitorService, PerformanceMetrics } from './performance-monitor.service'
import { EventEmitter2 } from '@nestjs/event-emitter'

export interface FunctionRuntimeInfo {
  functionId: string
  appid: string
  state: FunctionState
  sharedRuntimeInfo?: SharedRuntimeInfo
  lastStateChange?: Date
  dependencyCheck?: DependencyCheckResult
  canRun?: boolean
  deploymentStatus?: 'pending' | 'checking' | 'installing' | 'ready' | 'failed'
}

@Injectable()
export class FunctionRuntimeService {
  private readonly logger = new Logger(FunctionRuntimeService.name)

  constructor(
    private readonly processManager: ProcessManagerService,
    private readonly functionService: FunctionService,
    private readonly dependencyChecker: DependencyCheckerService,
    private readonly cacheService: FunctionCacheService,
    private readonly performanceMonitor: PerformanceMonitorService,
    private readonly eventEmitter: EventEmitter2,
  ) { }

  /**
   * Enhanced function deployment with dependency checking and auto-installation
   */
  async deployFunction(functionId: string): Promise<FunctionRuntimeInfo> {
    const deploymentStartTime = Date.now()

    try {
      this.logger.log(`Deploying function ${functionId} with dependency check`)

      // Check cache first
      const cached = this.cacheService.getCachedFunction(functionId)
      let func = cached?.function
      let dependencyCheck = cached?.dependencyCheck

      // Get function details if not cached
      if (!func) {
        func = await this.functionService.findById(functionId)
        if (!func) {
          throw new Error(`Function ${functionId} not found`)
        }
      }

      let deploymentStatus: 'pending' | 'checking' | 'installing' | 'ready' | 'failed' = 'checking'

      // Step 1: Check dependencies (use cache if available)
      if (!dependencyCheck) {
        dependencyCheck = await this.dependencyChecker.checkFunctionDependencies(func)
        // Cache the result
        this.cacheService.cacheFunction(functionId, func, dependencyCheck)
      }

      // Step 2: Check if function can run
      const canRunCheck = await this.dependencyChecker.canFunctionRun(func)

      if (!canRunCheck.canRun) {
        // Record performance metrics for failed deployment
        this.recordDeploymentMetrics(functionId, func.name, deploymentStartTime, false, canRunCheck.reason)

        return {
          functionId,
          appid: func.appid,
          state: FunctionState.STOPPED,
          dependencyCheck,
          canRun: false,
          deploymentStatus: 'failed',
          lastStateChange: new Date()
        }
      }

      // Step 3: If dependencies are missing, mark for installation
      if (!dependencyCheck.isComplete) {
        deploymentStatus = 'installing'
        this.logger.warn(`Function ${functionId} has missing dependencies: ${dependencyCheck.missingDependencies.join(', ')}`)

        // Emit event for missing dependencies
        this.eventEmitter.emit('function.deployment.dependencies_missing', {
          functionId,
          functionName: func.name,
          missingDependencies: dependencyCheck.missingDependencies
        })

        return {
          functionId,
          appid: func.appid,
          state: FunctionState.STOPPED,
          dependencyCheck,
          canRun: false,
          deploymentStatus,
          lastStateChange: new Date()
        }
      }

      // Step 4: Dependencies are complete, proceed with deployment
      deploymentStatus = 'ready'

      // Ensure shared runtime is running
      const sharedRuntimeInfo = await this.processManager.ensureSharedRuntimeRunning()

      // Update function state to RUNNING in database
      await this.functionService.updateFunctionState(functionId, FunctionState.RUNNING)

      // Invalidate cache since function state changed
      this.cacheService.invalidateFunction(functionId)

      // Notify shared runtime to reload functions
      await this.processManager.reloadSharedRuntime()

      // Record successful deployment metrics
      this.recordDeploymentMetrics(functionId, func.name, deploymentStartTime, true)

      // Emit deployment success event
      this.eventEmitter.emit('function.deployment.success', {
        functionId,
        functionName: func.name,
        duration: Date.now() - deploymentStartTime
      })

      this.logger.log(`Function ${functionId} deployed successfully`)

      return {
        functionId,
        appid: func.appid,
        state: FunctionState.RUNNING,
        sharedRuntimeInfo,
        dependencyCheck,
        canRun: true,
        deploymentStatus,
        lastStateChange: new Date()
      }
    } catch (error) {
      this.logger.error(`Failed to deploy function ${functionId}:`, error)

      // Record failed deployment metrics
      this.recordDeploymentMetrics(functionId, 'Unknown', deploymentStartTime, false, error.message)

      // Emit deployment failure event
      this.eventEmitter.emit('function.deployment.failed', {
        functionId,
        error: error.message,
        duration: Date.now() - deploymentStartTime
      })

      return {
        functionId,
        appid: '',
        state: FunctionState.STOPPED,
        canRun: false,
        deploymentStatus: 'failed',
        lastStateChange: new Date()
      }
    }
  }

  /**
   * Start a function by setting its state to RUNNING in the database
   * The shared runtime will pick up this change and load the function
   */
  async startFunction(functionId: string): Promise<FunctionRuntimeInfo> {
    const startTime = Date.now()

    try {
      this.logger.log(`Starting function ${functionId}`)

      // Get function details
      const func = await this.functionService.findById(functionId)
      if (!func) {
        throw new Error(`Function ${functionId} not found`)
      }

      // Ensure shared runtime is running
      const sharedRuntimeInfo = await this.processManager.ensureSharedRuntimeRunning()

      // Update function state to RUNNING in database
      await this.functionService.updateFunctionState(functionId, FunctionState.RUNNING)

      // Notify shared runtime to reload functions
      await this.processManager.reloadSharedRuntime()

      return {
        functionId,
        appid: func.appid,
        state: FunctionState.RUNNING,
        sharedRuntimeInfo,
        lastStateChange: new Date()
      }
    } catch (error) {
      this.logger.error(`Failed to start function ${functionId}:`, error)

      return {
        functionId,
        appid: '',
        state: FunctionState.STOPPED,
        lastStateChange: new Date()
      }
    }
  }

  /**
   * Stop a function by setting its state to STOPPED in the database
   * The shared runtime will pick up this change and unload the function
   */
  async stopFunction(functionId: string): Promise<FunctionRuntimeInfo> {
    const startTime = Date.now()

    try {
      this.logger.log(`Stopping function ${functionId}`)

      // Get function details
      const func = await this.functionService.findById(functionId)
      if (!func) {
        throw new Error(`Function ${functionId} not found`)
      }

      // Update function state to STOPPED in database
      await this.functionService.updateFunctionState(functionId, FunctionState.STOPPED)

      // Notify shared runtime to reload functions
      await this.processManager.reloadSharedRuntime()

      return {
        functionId,
        appid: func.appid,
        state: FunctionState.STOPPED,
        lastStateChange: new Date()
      }
    } catch (error) {
      this.logger.error(`Failed to stop function ${functionId}:`, error)

      return {
        functionId,
        appid: '',
        state: FunctionState.STOPPED,
        lastStateChange: new Date()
      }
    }
  }

  /**
   * Restart a function by toggling its state
   * In shared runtime, this means stopping and starting the function
   */
  async restartFunction(functionId: string): Promise<FunctionRuntimeInfo> {
    try {
      this.logger.log(`Restarting function ${functionId}`)

      // Stop first, then start
      await this.stopFunction(functionId)

      // Wait a moment for the change to propagate
      await new Promise(resolve => setTimeout(resolve, 500))

      // Start again
      return await this.startFunction(functionId)
    } catch (error) {
      this.logger.error(`Failed to restart function ${functionId}:`, error)

      return {
        functionId,
        appid: '',
        state: FunctionState.STOPPED,
        lastStateChange: new Date()
      }
    }
  }

  /**
   * Get function status from database
   */
  async getFunctionStatus(functionId: string): Promise<FunctionRuntimeInfo> {
    try {
      const func = await this.functionService.findById(functionId)
      if (!func) {
        throw new Error(`Function ${functionId} not found`)
      }

      const sharedRuntimeInfo = this.processManager.getSharedRuntimeInfo()

      return {
        functionId,
        appid: func.appid,
        state: func.state || FunctionState.STOPPED,
        sharedRuntimeInfo,
        lastStateChange: func.updatedAt
      }
    } catch (error) {
      this.logger.error(`Failed to get function status ${functionId}:`, error)
      return {
        functionId,
        appid: '',
        state: FunctionState.STOPPED,
        lastStateChange: new Date()
      }
    }
  }

  /**
   * Get shared runtime port (all functions use the same port)
   */
  getSharedRuntimePort(): number {
    return this.processManager.getSharedRuntimePort()
  }

  /**
   * Get all function statuses from database
   */
  async getAllFunctionStatuses(appid?: string): Promise<FunctionRuntimeInfo[]> {
    try {
      const functions = await this.functionService.findAll(appid)
      const sharedRuntimeInfo = this.processManager.getSharedRuntimeInfo()

      return functions.map(func => ({
        functionId: func._id.toString(),
        appid: func.appid,
        state: func.state || FunctionState.STOPPED,
        sharedRuntimeInfo,
        lastStateChange: func.updatedAt
      }))
    } catch (error) {
      this.logger.error('Failed to get all function statuses:', error)
      return []
    }
  }

  /**
   * Get shared runtime status
   */
  getSharedRuntimeStatus(): SharedRuntimeInfo | null {
    return this.processManager.getSharedRuntimeInfo()
  }

  /**
   * Ensure shared runtime is running
   */
  async ensureSharedRuntimeRunning(): Promise<SharedRuntimeInfo> {
    return this.processManager.ensureSharedRuntimeRunning()
  }

  /**
   * Get function performance statistics
   */
  getFunctionPerformanceStats(functionId: string) {
    return this.performanceMonitor.getFunctionStats(functionId)
  }

  /**
   * Get all functions performance overview
   */
  getPerformanceOverview() {
    return this.performanceMonitor.getSystemOverview()
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return this.cacheService.getCacheStats()
  }

  /**
   * Warm up cache with frequently used functions
   */
  async warmupCache(appid?: string): Promise<void> {
    try {
      const functions = await this.functionService.findAll(appid)
      await this.cacheService.warmupCache(functions)
      this.logger.log(`Cache warmed up with ${functions.length} functions`)
    } catch (error) {
      this.logger.error('Failed to warm up cache:', error)
    }
  }

  /**
   * Clear function cache
   */
  clearCache(functionId?: string): void {
    if (functionId) {
      this.cacheService.invalidateFunction(functionId)
    } else {
      this.cacheService.clearAll()
    }
  }

  /**
   * Get hot functions (most accessed)
   */
  getHotFunctions(limit: number = 10) {
    return this.cacheService.getHotFunctions(limit)
  }

  /**
   * Get performance trend for a function
   */
  getPerformanceTrend(functionId: string, hours: number = 24) {
    return this.performanceMonitor.getPerformanceTrend(functionId, hours)
  }

  /**
   * Clean up old performance data
   */
  cleanupPerformanceData(daysToKeep: number = 7): void {
    this.performanceMonitor.cleanupOldMetrics(daysToKeep)
  }

  /**
   * Record deployment performance metrics
   */
  private recordDeploymentMetrics(
    functionId: string,
    functionName: string,
    startTime: number,
    success: boolean,
    errorMessage?: string
  ): void {
    const executionTime = Date.now() - startTime
    const memoryUsage = process.memoryUsage().heapUsed / 1024 / 1024 // MB

    const metrics: PerformanceMetrics = {
      functionId,
      functionName,
      executionTime,
      memoryUsage,
      cpuUsage: 0, // Would need actual CPU monitoring
      timestamp: new Date(),
      success,
      errorMessage
    }

    this.performanceMonitor.recordMetrics(metrics)
  }
}