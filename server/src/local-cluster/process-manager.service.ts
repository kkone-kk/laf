import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common'
import * as child_process from 'child_process'
import * as path from 'path'
import * as fs from 'fs'
import * as http from 'http'
import * as net from 'net'

export interface SharedRuntimeInfo {
  pid: number
  port: number
  status: 'starting' | 'running' | 'stopped' | 'error'
  startTime?: Date
  lastHealthCheck?: Date
  restartCount?: number
}

export interface RuntimeHealth {
  isHealthy: boolean
  responseTime?: number
  error?: string
}

@Injectable()
export class ProcessManagerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ProcessManagerService.name)
  private sharedRuntimeProcess: child_process.ChildProcess | null = null
  private sharedRuntimeInfo: SharedRuntimeInfo | null = null
  private readonly sharedRuntimePort = parseInt(
    process.env.SHARED_RUNTIME_PORT || '8000',
  )
  private healthCheckInterval: NodeJS.Timeout | null = null
  private readonly maxRestartAttempts = 3
  private readonly healthCheckIntervalMs = 30000 // 30 seconds
  private startupPromise: Promise<SharedRuntimeInfo> | null = null

  constructor() { }

  async onModuleInit() {
    // Auto-start the shared runtime on module initialization
    await this.ensureSharedRuntimeRunning()
    this.startHealthChecking()
  }

  async onModuleDestroy() {
    this.stopHealthChecking()
    await this.stopSharedRuntime()
  }

  /**
   * Ensure the shared runtime process is running
   * This is the core of the new architecture - one shared runtime for all functions
   */
  async ensureSharedRuntimeRunning(): Promise<SharedRuntimeInfo> {
    // If there's already a startup in progress, wait for it
    if (this.startupPromise) {
      this.logger.log('Startup already in progress, waiting...')
      return this.startupPromise
    }

    // Check if process is still alive
    if (
      this.sharedRuntimeProcess &&
      this.sharedRuntimeInfo?.status === 'running'
    ) {
      try {
        // Verify the process is actually running
        process.kill(this.sharedRuntimeProcess.pid, 0)
        this.logger.log('Shared runtime already running')
        return this.sharedRuntimeInfo
      } catch (error) {
        // Process is dead, clean up
        this.logger.warn('Shared runtime process is dead, cleaning up...')
        this.sharedRuntimeProcess = null
        this.sharedRuntimeInfo = null
      }
    }

    // Start the startup process and cache the promise
    this.startupPromise = this.performStartup()

    try {
      const result = await this.startupPromise
      return result
    } finally {
      // Clear the promise when done
      this.startupPromise = null
    }
  }

  /**
   * Perform the actual startup process
   */
  private async performStartup(): Promise<SharedRuntimeInfo> {
    // Check if another process is using our port
    const isPortInUse = await this.isPortInUse(this.sharedRuntimePort)
    if (isPortInUse) {
      this.logger.warn(
        `Port ${this.sharedRuntimePort} is already in use, waiting for it to be free...`,
      )
      await this.waitForPortToBeFreed(this.sharedRuntimePort)
    }

    return this.startSharedRuntime()
  }

  /**
   * Start the shared runtime process
   * Uses runtimes/node-shared for shared node_modules
   */
  private async startSharedRuntime(): Promise<SharedRuntimeInfo> {
    this.logger.log('Starting shared runtime process...')

    // Use runtimes/node-shared as specified in requirements
    const runtimePath = path.resolve(__dirname, '../../../runtimes/node-shared')
    const distPath = path.join(runtimePath, 'dist/index.js')

    // Fallback to nodejs runtime if node-shared doesn't exist yet
    const fallbackRuntimePath = path.resolve(
      __dirname,
      '../../../runtimes/nodejs',
    )
    const fallbackDistPath = path.join(fallbackRuntimePath, 'dist/index.js')

    let actualRuntimePath = runtimePath
    let actualDistPath = distPath

    if (!fs.existsSync(distPath)) {
      if (fs.existsSync(fallbackDistPath)) {
        this.logger.warn(
          `Shared runtime not found at ${distPath}, using fallback: ${fallbackDistPath}`,
        )
        actualRuntimePath = fallbackRuntimePath
        actualDistPath = fallbackDistPath
      } else {
        throw new Error(
          `Neither shared runtime nor fallback runtime found. Please build the runtime first.`,
        )
      }
    }

    const processEnv = {
      ...process.env,
      __PORT: this.sharedRuntimePort.toString(),
      __SHARED_RUNTIME: 'true',
      NODE_ENV: process.env.NODE_ENV || 'development',
      // Required by runtime
      DB_URI: process.env.DATABASE_URL || process.env.DB_URI,
      SERVER_SECRET:
        process.env.JWT_SECRET ||
        process.env.SERVER_SECRET ||
        'default-secret-key',
    }

    this.sharedRuntimeInfo = {
      pid: 0,
      port: this.sharedRuntimePort,
      status: 'starting',
      startTime: new Date(),
    }

    const child = child_process.spawn('node', [actualDistPath], {
      env: processEnv,
      cwd: actualRuntimePath,
      stdio: 'inherit',
    })

    this.sharedRuntimeProcess = child
    this.sharedRuntimeInfo.pid = child.pid
    this.sharedRuntimeInfo.status = 'running'

    child.on('exit', (code) => {
      this.logger.warn(`Shared runtime exited with code ${code}`)
      this.sharedRuntimeProcess = null
      if (this.sharedRuntimeInfo) {
        this.sharedRuntimeInfo.status = code === 0 ? 'stopped' : 'error'
      }
    })

    child.on('error', (error) => {
      this.logger.error('Shared runtime error:', error)
      if (this.sharedRuntimeInfo) {
        this.sharedRuntimeInfo.status = 'error'
      }
    })

    this.logger.log(
      `Shared runtime started on port ${this.sharedRuntimePort} with PID ${child.pid}`,
    )
    return this.sharedRuntimeInfo
  }

  /**
   * Stop the shared runtime process
   */
  async stopSharedRuntime(): Promise<void> {
    if (this.sharedRuntimeProcess) {
      this.logger.log('Stopping shared runtime process...')
      this.sharedRuntimeProcess.kill()
      this.sharedRuntimeProcess = null
      if (this.sharedRuntimeInfo) {
        this.sharedRuntimeInfo.status = 'stopped'
      }
    }
  }

  /**
   * Restart the shared runtime process
   * This is called when environment variables change
   */
  async restartSharedRuntime(): Promise<SharedRuntimeInfo> {
    this.logger.log('Restarting shared runtime process...')
    await this.stopSharedRuntime()
    // Wait a bit for cleanup
    await new Promise((resolve) => setTimeout(resolve, 1000))
    return this.startSharedRuntime()
  }

  /**
   * Get shared runtime information
   */
  getSharedRuntimeInfo(): SharedRuntimeInfo | null {
    return this.sharedRuntimeInfo
  }

  /**
   * Get the shared runtime port
   */
  getSharedRuntimePort(): number {
    return this.sharedRuntimePort
  }

  /**
   * Check if shared runtime is running
   */
  isSharedRuntimeRunning(): boolean {
    return (
      this.sharedRuntimeProcess !== null &&
      this.sharedRuntimeInfo?.status === 'running'
    )
  }

  /**
   * Reload the shared runtime when functions change
   * The runtime will pick up changes by monitoring the database
   */
  async reloadSharedRuntime(): Promise<void> {
    if (this.isSharedRuntimeRunning()) {
      this.logger.log('Reloading shared runtime (functions changed)')
      // Send a signal to the runtime to reload functions
      // The runtime should be monitoring DB changes, but we can send a signal for immediate reload
      if (this.sharedRuntimeProcess) {
        this.sharedRuntimeProcess.kill('SIGUSR1') // Custom signal for reload
      }
    }
  }

  /**
   * Start health checking for the shared runtime
   */
  private startHealthChecking(): void {
    if (this.healthCheckInterval) {
      return // Already started
    }

    this.healthCheckInterval = setInterval(async () => {
      await this.performHealthCheck()
    }, this.healthCheckIntervalMs)

    this.logger.log('Health checking started')
  }

  /**
   * Stop health checking
   */
  private stopHealthChecking(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval)
      this.healthCheckInterval = null
      this.logger.log('Health checking stopped')
    }
  }

  /**
   * Perform health check on the shared runtime
   */
  private async performHealthCheck(): Promise<RuntimeHealth> {
    if (!this.isSharedRuntimeRunning()) {
      this.logger.warn(
        'Shared runtime is not running, attempting to restart...',
      )
      await this.handleUnhealthyRuntime()
      return { isHealthy: false, error: 'Runtime not running' }
    }

    const startTime = Date.now()

    try {
      const health = await this.checkRuntimeHealth()

      if (this.sharedRuntimeInfo) {
        this.sharedRuntimeInfo.lastHealthCheck = new Date()
      }

      if (!health.isHealthy) {
        this.logger.warn(
          'Shared runtime health check failed, attempting recovery...',
        )
        await this.handleUnhealthyRuntime()
      }

      return health
    } catch (error) {
      this.logger.error('Health check error:', error)
      await this.handleUnhealthyRuntime()
      return { isHealthy: false, error: error.message }
    }
  }

  /**
   * Check runtime health by making HTTP request
   */
  private async checkRuntimeHealth(): Promise<RuntimeHealth> {
    return new Promise((resolve) => {
      const startTime = Date.now()
      const timeout = 5000 // 5 second timeout

      const req = http.get(
        `http://localhost:${this.sharedRuntimePort}/_/healthz`,
        (res) => {
          const responseTime = Date.now() - startTime

          if (res.statusCode === 200) {
            resolve({ isHealthy: true, responseTime })
          } else {
            resolve({
              isHealthy: false,
              error: `HTTP ${res.statusCode}`,
              responseTime,
            })
          }
        },
      )

      req.setTimeout(timeout, () => {
        req.destroy()
        resolve({ isHealthy: false, error: 'Timeout' })
      })

      req.on('error', (error) => {
        resolve({ isHealthy: false, error: error.message })
      })
    })
  }

  /**
   * Handle unhealthy runtime by attempting restart
   */
  private async handleUnhealthyRuntime(): Promise<void> {
    if (!this.sharedRuntimeInfo) {
      await this.ensureSharedRuntimeRunning()
      return
    }

    const restartCount = this.sharedRuntimeInfo.restartCount || 0

    if (restartCount >= this.maxRestartAttempts) {
      this.logger.error(
        `Max restart attempts (${this.maxRestartAttempts}) reached for shared runtime`,
      )
      if (this.sharedRuntimeInfo) {
        this.sharedRuntimeInfo.status = 'error'
      }
      return
    }

    this.logger.warn(
      `Attempting to restart shared runtime (attempt ${restartCount + 1}/${this.maxRestartAttempts
      })`,
    )

    try {
      await this.restartSharedRuntime()

      if (this.sharedRuntimeInfo) {
        this.sharedRuntimeInfo.restartCount = restartCount + 1
      }

      this.logger.log('Shared runtime restarted successfully')
    } catch (error) {
      this.logger.error('Failed to restart shared runtime:', error)

      if (this.sharedRuntimeInfo) {
        this.sharedRuntimeInfo.status = 'error'
        this.sharedRuntimeInfo.restartCount = restartCount + 1
      }
    }
  }

  /**
   * Get runtime health status
   */
  async getRuntimeHealth(): Promise<RuntimeHealth> {
    if (!this.isSharedRuntimeRunning()) {
      return { isHealthy: false, error: 'Runtime not running' }
    }

    return this.checkRuntimeHealth()
  }

  /**
   * Check if a port is in use
   */
  private async isPortInUse(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const server = net.createServer()

      server.listen(port, () => {
        server.close(() => resolve(false))
      })

      server.on('error', () => resolve(true))
    })
  }

  /**
   * Wait for a port to be freed
   */
  private async waitForPortToBeFreed(
    port: number,
    maxWaitMs = 10000,
  ): Promise<void> {
    const startTime = Date.now()

    while (Date.now() - startTime < maxWaitMs) {
      const inUse = await this.isPortInUse(port)
      if (!inUse) {
        return
      }

      this.logger.log(`Waiting for port ${port} to be freed...`)
      await new Promise((resolve) => setTimeout(resolve, 1000))
    }

    throw new Error(`Port ${port} is still in use after ${maxWaitMs}ms`)
  }

  // Legacy compatibility methods for existing services
  // These will be deprecated as we migrate to shared runtime

  /**
   * @deprecated Use shared runtime instead
   */
  getProcess(appid: string) {
    // Return shared runtime process for compatibility
    return this.sharedRuntimeProcess
  }

  /**
   * @deprecated Use getSharedRuntimePort() instead
   */
  getPort(appid: string): number | undefined {
    // Return shared runtime port for compatibility
    return this.isSharedRuntimeRunning() ? this.sharedRuntimePort : undefined
  }

  /**
   * @deprecated Use ensureSharedRuntimeRunning() instead
   */
  async startProcess(appid: string, env: any) {
    this.logger.warn(
      `startProcess(${appid}) is deprecated, using shared runtime instead`,
    )
    const info = await this.ensureSharedRuntimeRunning()
    return { pid: info.pid, port: info.port }
  }

  /**
   * @deprecated Shared runtime is managed automatically
   */
  async stopProcess(appid: string) {
    this.logger.warn(
      `stopProcess(${appid}) is deprecated, shared runtime continues running`,
    )
    // Don't actually stop the shared runtime for individual apps
  }
}
