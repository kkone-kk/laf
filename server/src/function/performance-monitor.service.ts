import { Injectable, Logger } from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'

export interface PerformanceMetrics {
  functionId: string
  functionName: string
  executionTime: number
  memoryUsage: number
  cpuUsage: number
  timestamp: Date
  success: boolean
  errorMessage?: string
}

export interface FunctionPerformanceStats {
  functionId: string
  functionName: string
  totalExecutions: number
  successfulExecutions: number
  failedExecutions: number
  averageExecutionTime: number
  maxExecutionTime: number
  minExecutionTime: number
  averageMemoryUsage: number
  lastExecution: Date
  successRate: number
}

@Injectable()
export class PerformanceMonitorService {
  private readonly logger = new Logger(PerformanceMonitorService.name)
  private readonly metrics: Map<string, PerformanceMetrics[]> = new Map()
  private readonly maxMetricsPerFunction = 1000 // 每个函数最多保存1000条记录

  constructor(private readonly eventEmitter: EventEmitter2) { }

  /**
   * 记录函数执行指标
   */
  recordMetrics(metrics: PerformanceMetrics): void {
    const functionMetrics = this.metrics.get(metrics.functionId) || []

    // 添加新指标
    functionMetrics.push(metrics)

    // 保持最大记录数限制
    if (functionMetrics.length > this.maxMetricsPerFunction) {
      functionMetrics.shift() // 移除最旧的记录
    }

    this.metrics.set(metrics.functionId, functionMetrics)

    // 发送性能事件
    this.eventEmitter.emit('function.performance', metrics)

    // 检查性能异常
    this.checkPerformanceAnomalies(metrics, functionMetrics)
  }

  /**
   * 获取函数性能统计
   */
  getFunctionStats(functionId: string): FunctionPerformanceStats | null {
    const functionMetrics = this.metrics.get(functionId)
    if (!functionMetrics || functionMetrics.length === 0) {
      return null
    }

    const totalExecutions = functionMetrics.length
    const successfulExecutions = functionMetrics.filter(m => m.success).length
    const failedExecutions = totalExecutions - successfulExecutions

    const executionTimes = functionMetrics.map(m => m.executionTime)
    const memoryUsages = functionMetrics.map(m => m.memoryUsage)

    const averageExecutionTime = executionTimes.reduce((a, b) => a + b, 0) / totalExecutions
    const maxExecutionTime = Math.max(...executionTimes)
    const minExecutionTime = Math.min(...executionTimes)
    const averageMemoryUsage = memoryUsages.reduce((a, b) => a + b, 0) / totalExecutions

    const lastExecution = functionMetrics[functionMetrics.length - 1].timestamp
    const successRate = (successfulExecutions / totalExecutions) * 100

    return {
      functionId,
      functionName: functionMetrics[0].functionName,
      totalExecutions,
      successfulExecutions,
      failedExecutions,
      averageExecutionTime,
      maxExecutionTime,
      minExecutionTime,
      averageMemoryUsage,
      lastExecution,
      successRate
    }
  }

  /**
   * 获取所有函数的性能统计
   */
  getAllFunctionStats(): FunctionPerformanceStats[] {
    const stats: FunctionPerformanceStats[] = []

    for (const functionId of this.metrics.keys()) {
      const stat = this.getFunctionStats(functionId)
      if (stat) {
        stats.push(stat)
      }
    }

    return stats.sort((a, b) => b.lastExecution.getTime() - a.lastExecution.getTime())
  }

  /**
   * 获取性能趋势数据
   */
  getPerformanceTrend(functionId: string, hours: number = 24): PerformanceMetrics[] {
    const functionMetrics = this.metrics.get(functionId) || []
    const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000)

    return functionMetrics.filter(m => m.timestamp >= cutoffTime)
  }

  /**
   * 检查性能异常
   */
  private checkPerformanceAnomalies(
    currentMetrics: PerformanceMetrics,
    historicalMetrics: PerformanceMetrics[]
  ): void {
    if (historicalMetrics.length < 10) return // 需要足够的历史数据

    const recentMetrics = historicalMetrics.slice(-10) // 最近10次执行
    const avgExecutionTime = recentMetrics.reduce((sum, m) => sum + m.executionTime, 0) / recentMetrics.length
    const avgMemoryUsage = recentMetrics.reduce((sum, m) => sum + m.memoryUsage, 0) / recentMetrics.length

    // 检查执行时间异常（超过平均值的3倍）
    if (currentMetrics.executionTime > avgExecutionTime * 3) {
      this.logger.warn(`Performance anomaly detected for function ${currentMetrics.functionName}: execution time ${currentMetrics.executionTime}ms is significantly higher than average ${avgExecutionTime.toFixed(2)}ms`)

      this.eventEmitter.emit('function.performance.anomaly', {
        type: 'execution_time',
        functionId: currentMetrics.functionId,
        functionName: currentMetrics.functionName,
        currentValue: currentMetrics.executionTime,
        averageValue: avgExecutionTime,
        threshold: avgExecutionTime * 3
      })
    }

    // 检查内存使用异常（超过平均值的2倍）
    if (currentMetrics.memoryUsage > avgMemoryUsage * 2) {
      this.logger.warn(`Memory usage anomaly detected for function ${currentMetrics.functionName}: memory usage ${currentMetrics.memoryUsage}MB is significantly higher than average ${avgMemoryUsage.toFixed(2)}MB`)

      this.eventEmitter.emit('function.performance.anomaly', {
        type: 'memory_usage',
        functionId: currentMetrics.functionId,
        functionName: currentMetrics.functionName,
        currentValue: currentMetrics.memoryUsage,
        averageValue: avgMemoryUsage,
        threshold: avgMemoryUsage * 2
      })
    }

    // 检查错误率异常
    const recentFailureRate = recentMetrics.filter(m => !m.success).length / recentMetrics.length
    if (recentFailureRate > 0.5) { // 失败率超过50%
      this.logger.warn(`High failure rate detected for function ${currentMetrics.functionName}: ${(recentFailureRate * 100).toFixed(1)}%`)

      this.eventEmitter.emit('function.performance.anomaly', {
        type: 'failure_rate',
        functionId: currentMetrics.functionId,
        functionName: currentMetrics.functionName,
        currentValue: recentFailureRate * 100,
        threshold: 50
      })
    }
  }

  /**
   * 清理旧的性能数据
   */
  cleanupOldMetrics(daysToKeep: number = 7): void {
    const cutoffTime = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000)
    let totalCleaned = 0

    for (const [functionId, metrics] of this.metrics.entries()) {
      const filteredMetrics = metrics.filter(m => m.timestamp >= cutoffTime)
      const cleanedCount = metrics.length - filteredMetrics.length

      if (cleanedCount > 0) {
        this.metrics.set(functionId, filteredMetrics)
        totalCleaned += cleanedCount
      }
    }

    if (totalCleaned > 0) {
      this.logger.log(`Cleaned up ${totalCleaned} old performance metrics older than ${daysToKeep} days`)
    }
  }

  /**
   * 获取系统整体性能概览
   */
  getSystemOverview(): {
    totalFunctions: number
    totalExecutions: number
    averageSuccessRate: number
    averageExecutionTime: number
    topPerformingFunctions: FunctionPerformanceStats[]
    poorPerformingFunctions: FunctionPerformanceStats[]
  } {
    const allStats = this.getAllFunctionStats()

    const totalFunctions = allStats.length
    const totalExecutions = allStats.reduce((sum, stat) => sum + stat.totalExecutions, 0)
    const averageSuccessRate = allStats.length > 0
      ? allStats.reduce((sum, stat) => sum + stat.successRate, 0) / allStats.length
      : 0
    const averageExecutionTime = allStats.length > 0
      ? allStats.reduce((sum, stat) => sum + stat.averageExecutionTime, 0) / allStats.length
      : 0

    // 按成功率和执行时间排序
    const sortedByPerformance = [...allStats].sort((a, b) => {
      const scoreA = a.successRate - (a.averageExecutionTime / 1000) // 成功率高、执行时间短的得分高
      const scoreB = b.successRate - (b.averageExecutionTime / 1000)
      return scoreB - scoreA
    })

    return {
      totalFunctions,
      totalExecutions,
      averageSuccessRate,
      averageExecutionTime,
      topPerformingFunctions: sortedByPerformance.slice(0, 5),
      poorPerformingFunctions: sortedByPerformance.slice(-5).reverse()
    }
  }
}