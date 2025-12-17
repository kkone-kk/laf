import { Injectable, Logger, LogLevel } from '@nestjs/common'

export interface LoggerConfig {
  level: LogLevel
  enableDebugInProduction: boolean
  maxLogSize: number
  enablePerformanceLogging: boolean
}

@Injectable()
export class SmartLoggerService {
  private readonly config: LoggerConfig
  private performanceMetrics: Map<string, number> = new Map()

  constructor() {
    this.config = {
      level: (process.env.LOG_LEVEL as LogLevel) || 'log',
      enableDebugInProduction: process.env.ENABLE_DEBUG_IN_PRODUCTION === 'true',
      maxLogSize: parseInt(process.env.MAX_LOG_SIZE || '1000'),
      enablePerformanceLogging: process.env.ENABLE_PERFORMANCE_LOGGING === 'true'
    }
  }

  createLogger(context: string): Logger {
    return new Logger(context)
  }

  shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['error', 'warn', 'log', 'debug', 'verbose']
    const currentLevelIndex = levels.indexOf(this.config.level)
    const requestedLevelIndex = levels.indexOf(level)

    // In production, only log debug if explicitly enabled
    if (level === 'debug' && process.env.NODE_ENV === 'production') {
      return this.config.enableDebugInProduction
    }

    return requestedLevelIndex <= currentLevelIndex
  }

  logPerformance(operation: string, startTime: number, context?: string) {
    if (!this.config.enablePerformanceLogging) return

    const duration = Date.now() - startTime
    const key = context ? `${context}:${operation}` : operation

    // Track average performance
    const existing = this.performanceMetrics.get(key) || 0
    this.performanceMetrics.set(key, (existing + duration) / 2)

    if (duration > 1000) { // Log slow operations
      const logger = new Logger('Performance')
      logger.warn(`Slow operation detected: ${key} took ${duration}ms`)
    }
  }

  getPerformanceMetrics(): Record<string, number> {
    return Object.fromEntries(this.performanceMetrics)
  }

  clearPerformanceMetrics() {
    this.performanceMetrics.clear()
  }
}