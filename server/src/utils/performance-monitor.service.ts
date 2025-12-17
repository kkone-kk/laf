import { Injectable, Logger } from '@nestjs/common'

export interface PerformanceMetrics {
  memoryUsage: NodeJS.MemoryUsage
  cpuUsage: NodeJS.CpuUsage
  uptime: number
  timestamp: Date
}

export interface SystemHealth {
  status: 'healthy' | 'warning' | 'critical'
  metrics: PerformanceMetrics
  issues: string[]
}

@Injectable()
export class PerformanceMonitorService {
  private readonly logger = new Logger(PerformanceMonitorService.name)
  private metricsHistory: PerformanceMetrics[] = []
  private readonly maxHistorySize = 100
  private monitoringInterval: NodeJS.Timeout | null = null

  constructor() {
    this.startMonitoring()
  }

  private startMonitoring() {
    // Monitor every 30 seconds
    this.monitoringInterval = setInterval(() => {
      this.collectMetrics()
    }, 30000)
  }

  private collectMetrics() {
    const metrics: PerformanceMetrics = {
      memoryUsage: process.memoryUsage(),
      cpuUsage: process.cpuUsage(),
      uptime: process.uptime(),
      timestamp: new Date()
    }

    this.metricsHistory.push(metrics)

    // Keep only recent metrics
    if (this.metricsHistory.length > this.maxHistorySize) {
      this.metricsHistory.shift()
    }

    // Check for issues
    this.checkSystemHealth(metrics)
  }

  private checkSystemHealth(metrics: PerformanceMetrics) {
    const issues: string[] = []

    // Memory usage check (warn if over 500MB, critical if over 1GB)
    const memoryMB = metrics.memoryUsage.heapUsed / 1024 / 1024
    if (memoryMB > 1024) {
      issues.push(`Critical memory usage: ${memoryMB.toFixed(2)}MB`)
      this.logger.error(`Critical memory usage: ${memoryMB.toFixed(2)}MB`)
    } else if (memoryMB > 500) {
      issues.push(`High memory usage: ${memoryMB.toFixed(2)}MB`)
      this.logger.warn(`High memory usage: ${memoryMB.toFixed(2)}MB`)
    }

    // CPU usage check (simplified - just log for now)
    const cpuUser = metrics.cpuUsage.user / 1000000 // Convert to seconds
    const cpuSystem = metrics.cpuUsage.system / 1000000

    if (cpuUser + cpuSystem > 10) { // High CPU usage
      issues.push(`High CPU usage detected`)
      this.logger.warn(`High CPU usage: user=${cpuUser.toFixed(2)}s, system=${cpuSystem.toFixed(2)}s`)
    }
  }

  getSystemHealth(): SystemHealth {
    const latestMetrics = this.metricsHistory[this.metricsHistory.length - 1]
    if (!latestMetrics) {
      return {
        status: 'warning',
        metrics: {
          memoryUsage: process.memoryUsage(),
          cpuUsage: process.cpuUsage(),
          uptime: process.uptime(),
          timestamp: new Date()
        },
        issues: ['No metrics available']
      }
    }

    const issues: string[] = []
    let status: 'healthy' | 'warning' | 'critical' = 'healthy'

    // Check memory
    const memoryMB = latestMetrics.memoryUsage.heapUsed / 1024 / 1024
    if (memoryMB > 1024) {
      status = 'critical'
      issues.push(`Critical memory usage: ${memoryMB.toFixed(2)}MB`)
    } else if (memoryMB > 500) {
      status = 'warning'
      issues.push(`High memory usage: ${memoryMB.toFixed(2)}MB`)
    }

    return {
      status,
      metrics: latestMetrics,
      issues
    }
  }

  getMetricsHistory(): PerformanceMetrics[] {
    return [...this.metricsHistory]
  }

  stopMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval)
      this.monitoringInterval = null
    }
  }
}