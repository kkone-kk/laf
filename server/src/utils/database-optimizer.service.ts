import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { MongoClient, MongoClientOptions } from 'mongodb'

export interface DatabaseMetrics {
  activeConnections: number
  availableConnections: number
  totalConnections: number
  commandsPerSecond: number
  queriesPerSecond: number
  lastMetricsUpdate: Date
}

export interface ConnectionPoolConfig {
  minPoolSize: number
  maxPoolSize: number
  maxIdleTimeMS: number
  waitQueueTimeoutMS: number
  serverSelectionTimeoutMS: number
}

@Injectable()
export class DatabaseOptimizerService implements OnModuleInit {
  private readonly logger = new Logger(DatabaseOptimizerService.name)
  private metrics: DatabaseMetrics = {
    activeConnections: 0,
    availableConnections: 0,
    totalConnections: 0,
    commandsPerSecond: 0,
    queriesPerSecond: 0,
    lastMetricsUpdate: new Date()
  }

  private readonly optimizedConfig: ConnectionPoolConfig = {
    minPoolSize: parseInt(process.env.DB_MIN_POOL_SIZE || '5'),
    maxPoolSize: parseInt(process.env.DB_MAX_POOL_SIZE || '20'),
    maxIdleTimeMS: parseInt(process.env.DB_MAX_IDLE_TIME_MS || '30000'),
    waitQueueTimeoutMS: parseInt(process.env.DB_WAIT_QUEUE_TIMEOUT_MS || '5000'),
    serverSelectionTimeoutMS: parseInt(process.env.DB_SERVER_SELECTION_TIMEOUT_MS || '5000')
  }

  async onModuleInit() {
    this.logger.log('Database optimizer initialized with config:', this.optimizedConfig)
    this.startMetricsCollection()
  }

  /**
   * Get optimized MongoDB connection options
   */
  getOptimizedConnectionOptions(): MongoClientOptions {
    return {
      minPoolSize: this.optimizedConfig.minPoolSize,
      maxPoolSize: this.optimizedConfig.maxPoolSize,
      maxIdleTimeMS: this.optimizedConfig.maxIdleTimeMS,
      waitQueueTimeoutMS: this.optimizedConfig.waitQueueTimeoutMS,
      serverSelectionTimeoutMS: this.optimizedConfig.serverSelectionTimeoutMS,

      // Connection optimization
      connectTimeoutMS: 10000,
      socketTimeoutMS: 45000,

      // Compression for better network performance
      compressors: ['zstd', 'zlib'],

      // Read preference for better load distribution
      readPreference: 'secondaryPreferred',

      // Write concern for better performance vs consistency balance
      writeConcern: {
        w: 1,
        j: false, // Don't wait for journal sync for better performance
        wtimeout: 5000
      },

      // Monitoring
      monitorCommands: true,

      // Retry writes for better reliability
      retryWrites: true,
      retryReads: true
    }
  }

  /**
   * Start collecting database metrics
   */
  private startMetricsCollection() {
    // Collect metrics every 30 seconds
    setInterval(() => {
      this.collectMetrics()
    }, 30000)
  }

  /**
   * Collect database performance metrics
   */
  private async collectMetrics() {
    try {
      // This would typically connect to your MongoDB instance
      // For now, we'll simulate metrics collection
      const connectionString = process.env.DATABASE_URL || process.env.DB_URI

      if (!connectionString) {
        this.logger.warn('No database connection string found')
        return
      }

      // In a real implementation, you would:
      // 1. Connect to MongoDB
      // 2. Run db.serverStatus() to get connection pool stats
      // 3. Run db.runCommand({connPoolStats: 1}) for detailed pool info
      // 4. Calculate queries per second from opcounters

      // For now, we'll update with simulated data
      this.metrics = {
        activeConnections: Math.floor(Math.random() * 10) + 1,
        availableConnections: this.optimizedConfig.maxPoolSize - Math.floor(Math.random() * 10),
        totalConnections: this.optimizedConfig.maxPoolSize,
        commandsPerSecond: Math.floor(Math.random() * 100) + 10,
        queriesPerSecond: Math.floor(Math.random() * 50) + 5,
        lastMetricsUpdate: new Date()
      }

      // Log warnings for potential issues
      if (this.metrics.activeConnections > this.optimizedConfig.maxPoolSize * 0.8) {
        this.logger.warn(`High connection usage: ${this.metrics.activeConnections}/${this.metrics.totalConnections}`)
      }

      if (this.metrics.queriesPerSecond > 100) {
        this.logger.warn(`High query rate detected: ${this.metrics.queriesPerSecond} queries/sec`)
      }

    } catch (error) {
      this.logger.error('Failed to collect database metrics:', error)
    }
  }

  /**
   * Get current database metrics
   */
  getMetrics(): DatabaseMetrics {
    return { ...this.metrics }
  }

  /**
   * Get connection pool configuration
   */
  getConnectionPoolConfig(): ConnectionPoolConfig {
    return { ...this.optimizedConfig }
  }

  /**
   * Analyze and suggest optimizations
   */
  analyzePerformance(): string[] {
    const suggestions: string[] = []

    if (this.metrics.activeConnections > this.optimizedConfig.maxPoolSize * 0.9) {
      suggestions.push('Consider increasing maxPoolSize - connection pool is nearly exhausted')
    }

    if (this.metrics.queriesPerSecond > 200) {
      suggestions.push('High query rate detected - consider implementing query caching')
    }

    if (this.metrics.commandsPerSecond > 500) {
      suggestions.push('High command rate - consider optimizing database operations')
    }

    if (suggestions.length === 0) {
      suggestions.push('Database performance looks healthy')
    }

    return suggestions
  }
}