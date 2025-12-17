import { Injectable, Logger } from '@nestjs/common'
import { FunctionRuntimeService, FunctionRuntimeInfo } from './function-runtime.service'
import { FunctionService } from './function.service'
import { DependencyCheckerService } from './dependency-checker.service'
import { EventEmitter2 } from '@nestjs/event-emitter'

export interface BatchDeploymentRequest {
  functionIds: string[]
  options?: {
    parallel?: boolean
    maxConcurrency?: number
    skipDependencyCheck?: boolean
    autoInstallDependencies?: boolean
  }
}

export interface BatchDeploymentResult {
  totalFunctions: number
  successfulDeployments: number
  failedDeployments: number
  results: Array<{
    functionId: string
    functionName: string
    success: boolean
    result?: FunctionRuntimeInfo
    error?: string
    duration: number
  }>
  totalDuration: number
  missingDependencies: string[]
}

@Injectable()
export class BatchDeploymentService {
  private readonly logger = new Logger(BatchDeploymentService.name)

  constructor(
    private readonly functionRuntimeService: FunctionRuntimeService,
    private readonly functionService: FunctionService,
    private readonly dependencyChecker: DependencyCheckerService,
    private readonly eventEmitter: EventEmitter2,
  ) { }

  /**
   * 批量部署函数
   */
  async batchDeploy(request: BatchDeploymentRequest): Promise<BatchDeploymentResult> {
    const startTime = Date.now()
    const { functionIds, options = {} } = request
    const {
      parallel = true,
      maxConcurrency = 5,
      skipDependencyCheck = false,
      autoInstallDependencies = true
    } = options

    this.logger.log(`Starting batch deployment of ${functionIds.length} functions`)

    // 发送批量部署开始事件
    this.eventEmitter.emit('batch.deployment.started', {
      functionIds,
      options
    })

    const results: BatchDeploymentResult['results'] = []
    const allMissingDependencies = new Set<string>()

    try {
      if (parallel) {
        // 并行部署
        const chunks = this.chunkArray(functionIds, maxConcurrency)

        for (const chunk of chunks) {
          const chunkPromises = chunk.map(functionId =>
            this.deploySingleFunction(functionId, skipDependencyCheck, autoInstallDependencies)
          )

          const chunkResults = await Promise.allSettled(chunkPromises)

          chunkResults.forEach((result, index) => {
            const functionId = chunk[index]

            if (result.status === 'fulfilled') {
              results.push(result.value)
              if (result.value.result?.dependencyCheck?.missingDependencies) {
                result.value.result.dependencyCheck.missingDependencies.forEach(dep =>
                  allMissingDependencies.add(dep)
                )
              }
            } else {
              results.push({
                functionId,
                functionName: 'Unknown',
                success: false,
                error: result.reason?.message || 'Unknown error',
                duration: 0
              })
            }
          })
        }
      } else {
        // 串行部署
        for (const functionId of functionIds) {
          try {
            const result = await this.deploySingleFunction(functionId, skipDependencyCheck, autoInstallDependencies)
            results.push(result)

            if (result.result?.dependencyCheck?.missingDependencies) {
              result.result.dependencyCheck.missingDependencies.forEach(dep =>
                allMissingDependencies.add(dep)
              )
            }
          } catch (error) {
            results.push({
              functionId,
              functionName: 'Unknown',
              success: false,
              error: error.message || 'Unknown error',
              duration: 0
            })
          }
        }
      }

      const totalDuration = Date.now() - startTime
      const successfulDeployments = results.filter(r => r.success).length
      const failedDeployments = results.length - successfulDeployments

      const batchResult: BatchDeploymentResult = {
        totalFunctions: functionIds.length,
        successfulDeployments,
        failedDeployments,
        results,
        totalDuration,
        missingDependencies: Array.from(allMissingDependencies)
      }

      // 发送批量部署完成事件
      this.eventEmitter.emit('batch.deployment.completed', batchResult)

      this.logger.log(`Batch deployment completed: ${successfulDeployments}/${functionIds.length} successful in ${totalDuration}ms`)

      return batchResult

    } catch (error) {
      this.logger.error('Batch deployment failed:', error)

      // 发送批量部署失败事件
      this.eventEmitter.emit('batch.deployment.failed', {
        functionIds,
        error: error.message,
        duration: Date.now() - startTime
      })

      throw error
    }
  }

  /**
   * 部署单个函数
   */
  private async deploySingleFunction(
    functionId: string,
    skipDependencyCheck: boolean,
    autoInstallDependencies: boolean
  ): Promise<BatchDeploymentResult['results'][0]> {
    const startTime = Date.now()

    try {
      // 获取函数信息
      const func = await this.functionService.findById(functionId)
      if (!func) {
        throw new Error(`Function ${functionId} not found`)
      }

      // 部署函数
      const result = await this.functionRuntimeService.deployFunction(functionId)

      const duration = Date.now() - startTime

      return {
        functionId,
        functionName: func.name,
        success: result.canRun === true,
        result,
        duration
      }
    } catch (error) {
      const duration = Date.now() - startTime

      // 尝试获取函数名称
      let functionName = 'Unknown'
      try {
        const func = await this.functionService.findById(functionId)
        if (func) functionName = func.name
      } catch { }

      return {
        functionId,
        functionName,
        success: false,
        error: error.message || 'Unknown error',
        duration
      }
    }
  }

  /**
   * 批量停止函数
   */
  async batchStop(functionIds: string[]): Promise<BatchDeploymentResult> {
    const startTime = Date.now()

    this.logger.log(`Starting batch stop of ${functionIds.length} functions`)

    const results: BatchDeploymentResult['results'] = []

    for (const functionId of functionIds) {
      const functionStartTime = Date.now()

      try {
        const func = await this.functionService.findById(functionId)
        if (!func) {
          throw new Error(`Function ${functionId} not found`)
        }

        const result = await this.functionRuntimeService.stopFunction(functionId)

        results.push({
          functionId,
          functionName: func.name,
          success: true,
          result,
          duration: Date.now() - functionStartTime
        })
      } catch (error) {
        let functionName = 'Unknown'
        try {
          const func = await this.functionService.findById(functionId)
          if (func) functionName = func.name
        } catch { }

        results.push({
          functionId,
          functionName,
          success: false,
          error: error.message || 'Unknown error',
          duration: Date.now() - functionStartTime
        })
      }
    }

    const totalDuration = Date.now() - startTime
    const successfulDeployments = results.filter(r => r.success).length
    const failedDeployments = results.length - successfulDeployments

    const batchResult: BatchDeploymentResult = {
      totalFunctions: functionIds.length,
      successfulDeployments,
      failedDeployments,
      results,
      totalDuration,
      missingDependencies: []
    }

    this.logger.log(`Batch stop completed: ${successfulDeployments}/${functionIds.length} successful in ${totalDuration}ms`)

    return batchResult
  }

  /**
   * 批量重启函数
   */
  async batchRestart(functionIds: string[]): Promise<BatchDeploymentResult> {
    const startTime = Date.now()

    this.logger.log(`Starting batch restart of ${functionIds.length} functions`)

    // 先停止所有函数
    const stopResult = await this.batchStop(functionIds)

    // 等待一段时间确保停止完成
    await new Promise(resolve => setTimeout(resolve, 1000))

    // 再启动所有函数
    const startResult = await this.batchDeploy({
      functionIds,
      options: { parallel: true, maxConcurrency: 3 }
    })

    // 合并结果
    const totalDuration = Date.now() - startTime

    return {
      ...startResult,
      totalDuration
    }
  }

  /**
   * 获取批量部署建议
   */
  async getBatchDeploymentRecommendations(functionIds: string[]): Promise<{
    recommendedOrder: string[]
    dependencyGroups: Array<{
      dependencies: string[]
      functions: string[]
    }>
    estimatedDuration: number
    warnings: string[]
  }> {
    const functions = await Promise.all(
      functionIds.map(id => this.functionService.findById(id))
    )

    const validFunctions = functions.filter(f => f !== null)
    const warnings: string[] = []

    if (validFunctions.length < functionIds.length) {
      warnings.push(`${functionIds.length - validFunctions.length} functions not found`)
    }

    // 分析依赖关系
    const dependencyAnalysis = await Promise.all(
      validFunctions.map(async func => {
        const depCheck = await this.dependencyChecker.checkFunctionDependencies(func)
        return {
          functionId: func._id.toString(),
          functionName: func.name,
          dependencies: depCheck.missingDependencies,
          complexity: this.estimateFunctionComplexity(func)
        }
      })
    )

    // 按复杂度排序（简单的先部署）
    const recommendedOrder = dependencyAnalysis
      .sort((a, b) => a.complexity - b.complexity)
      .map(item => item.functionId)

    // 分组相同依赖的函数
    const dependencyGroups = this.groupFunctionsByDependencies(dependencyAnalysis)

    // 估算部署时间
    const estimatedDuration = this.estimateBatchDeploymentDuration(dependencyAnalysis)

    return {
      recommendedOrder,
      dependencyGroups,
      estimatedDuration,
      warnings
    }
  }

  /**
   * 将数组分块
   */
  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = []
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize))
    }
    return chunks
  }

  /**
   * 估算函数复杂度
   */
  private estimateFunctionComplexity(func: any): number {
    const codeLength = func.source?.code?.length || 0
    const methodCount = func.methods?.length || 0
    const hasWebsocket = func.websocket ? 1 : 0

    return codeLength / 1000 + methodCount * 2 + hasWebsocket * 5
  }

  /**
   * 按依赖分组函数
   */
  private groupFunctionsByDependencies(analysis: Array<{
    functionId: string
    functionName: string
    dependencies: string[]
    complexity: number
  }>): Array<{ dependencies: string[]; functions: string[] }> {
    const groups = new Map<string, string[]>()

    for (const item of analysis) {
      const depKey = item.dependencies.sort().join(',')
      if (!groups.has(depKey)) {
        groups.set(depKey, [])
      }
      groups.get(depKey)!.push(item.functionId)
    }

    return Array.from(groups.entries()).map(([depKey, functions]) => ({
      dependencies: depKey ? depKey.split(',') : [],
      functions
    }))
  }

  /**
   * 估算批量部署时间
   */
  private estimateBatchDeploymentDuration(analysis: Array<{
    functionId: string
    functionName: string
    dependencies: string[]
    complexity: number
  }>): number {
    // 基础部署时间：每个函数2秒
    let baseDuration = analysis.length * 2000

    // 依赖安装时间：每个唯一依赖5秒
    const uniqueDependencies = new Set<string>()
    analysis.forEach(item => {
      item.dependencies.forEach(dep => uniqueDependencies.add(dep))
    })
    const dependencyDuration = uniqueDependencies.size * 5000

    // 复杂度影响：复杂函数需要更多时间
    const complexityDuration = analysis.reduce((sum, item) => sum + item.complexity * 100, 0)

    return baseDuration + dependencyDuration + complexityDuration
  }
}