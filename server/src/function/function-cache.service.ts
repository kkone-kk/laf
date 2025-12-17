import { Injectable, Logger } from '@nestjs/common'
import { CloudFunction } from './entities/cloud-function'
import { DependencyCheckResult } from './dependency-checker.service'

interface CachedFunctionInfo {
  function: CloudFunction
  dependencyCheck?: DependencyCheckResult
  lastUpdated: Date
  accessCount: number
  lastAccessed: Date
}

interface CachedDependencyInfo {
  dependencies: string[]
  lastUpdated: Date
  accessCount: number
}

@Injectable()
export class FunctionCacheService {
  private readonly logger = new Logger(FunctionCacheService.name)

  // 函数信息缓存
  private readonly functionCache = new Map<string, CachedFunctionInfo>()

  // 依赖信息缓存
  private readonly dependencyCache = new Map<string, CachedDependencyInfo>()

  // 缓存配置
  private readonly FUNCTION_CACHE_TTL = 5 * 60 * 1000 // 5分钟
  private readonly DEPENDENCY_CACHE_TTL = 10 * 60 * 1000 // 10分钟
  private readonly MAX_CACHE_SIZE = 1000

  /**
   * 缓存函数信息
   */
  cacheFunction(functionId: string, func: CloudFunction, dependencyCheck?: DependencyCheckResult): void {
    const now = new Date()
    const existing = this.functionCache.get(functionId)

    this.functionCache.set(functionId, {
      function: func,
      dependencyCheck,
      lastUpdated: now,
      accessCount: existing ? existing.accessCount + 1 : 1,
      lastAccessed: now
    })

    this.cleanupCache()
  }

  /**
   * 获取缓存的函数信息
   */
  getCachedFunction(functionId: string): { function: CloudFunction; dependencyCheck?: DependencyCheckResult } | null {
    const cached = this.functionCache.get(functionId)
    if (!cached) return null

    const now = new Date()
    const age = now.getTime() - cached.lastUpdated.getTime()

    // 检查是否过期
    if (age > this.FUNCTION_CACHE_TTL) {
      this.functionCache.delete(functionId)
      return null
    }

    // 更新访问信息
    cached.accessCount++
    cached.lastAccessed = now

    return {
      function: cached.function,
      dependencyCheck: cached.dependencyCheck
    }
  }

  /**
   * 缓存依赖信息
   */
  cacheDependencies(key: string, dependencies: string[]): void {
    const now = new Date()
    const existing = this.dependencyCache.get(key)

    this.dependencyCache.set(key, {
      dependencies: [...dependencies],
      lastUpdated: now,
      accessCount: existing ? existing.accessCount + 1 : 1
    })

    this.cleanupCache()
  }

  /**
   * 获取缓存的依赖信息
   */
  getCachedDependencies(key: string): string[] | null {
    const cached = this.dependencyCache.get(key)
    if (!cached) return null

    const now = new Date()
    const age = now.getTime() - cached.lastUpdated.getTime()

    // 检查是否过期
    if (age > this.DEPENDENCY_CACHE_TTL) {
      this.dependencyCache.delete(key)
      return null
    }

    // 更新访问计数
    cached.accessCount++

    return [...cached.dependencies]
  }

  /**
   * 使函数缓存失效
   */
  invalidateFunction(functionId: string): void {
    this.functionCache.delete(functionId)
    this.logger.debug(`Invalidated cache for function ${functionId}`)
  }

  /**
   * 使依赖缓存失效
   */
  invalidateDependencies(key: string): void {
    this.dependencyCache.delete(key)
    this.logger.debug(`Invalidated dependency cache for key ${key}`)
  }

  /**
   * 批量使函数缓存失效
   */
  invalidateFunctionsByAppId(appid: string): void {
    let invalidatedCount = 0

    for (const [functionId, cached] of this.functionCache.entries()) {
      if (cached.function.appid === appid) {
        this.functionCache.delete(functionId)
        invalidatedCount++
      }
    }

    if (invalidatedCount > 0) {
      this.logger.debug(`Invalidated ${invalidatedCount} function caches for app ${appid}`)
    }
  }

  /**
   * 清理过期缓存
   */
  private cleanupCache(): void {
    const now = new Date()

    // 清理过期的函数缓存
    for (const [functionId, cached] of this.functionCache.entries()) {
      const age = now.getTime() - cached.lastUpdated.getTime()
      if (age > this.FUNCTION_CACHE_TTL) {
        this.functionCache.delete(functionId)
      }
    }

    // 清理过期的依赖缓存
    for (const [key, cached] of this.dependencyCache.entries()) {
      const age = now.getTime() - cached.lastUpdated.getTime()
      if (age > this.DEPENDENCY_CACHE_TTL) {
        this.dependencyCache.delete(key)
      }
    }

    // 如果缓存过大，清理最少使用的条目
    if (this.functionCache.size > this.MAX_CACHE_SIZE) {
      this.evictLeastUsedFunctions()
    }

    if (this.dependencyCache.size > this.MAX_CACHE_SIZE) {
      this.evictLeastUsedDependencies()
    }
  }

  /**
   * 清理最少使用的函数缓存
   */
  private evictLeastUsedFunctions(): void {
    const entries = Array.from(this.functionCache.entries())

    // 按访问次数和最后访问时间排序
    entries.sort((a, b) => {
      const scoreA = a[1].accessCount + (a[1].lastAccessed.getTime() / 1000000)
      const scoreB = b[1].accessCount + (b[1].lastAccessed.getTime() / 1000000)
      return scoreA - scoreB
    })

    // 删除最少使用的25%
    const toDelete = Math.floor(entries.length * 0.25)
    for (let i = 0; i < toDelete; i++) {
      this.functionCache.delete(entries[i][0])
    }

    this.logger.debug(`Evicted ${toDelete} least used function cache entries`)
  }

  /**
   * 清理最少使用的依赖缓存
   */
  private evictLeastUsedDependencies(): void {
    const entries = Array.from(this.dependencyCache.entries())

    // 按访问次数排序
    entries.sort((a, b) => a[1].accessCount - b[1].accessCount)

    // 删除最少使用的25%
    const toDelete = Math.floor(entries.length * 0.25)
    for (let i = 0; i < toDelete; i++) {
      this.dependencyCache.delete(entries[i][0])
    }

    this.logger.debug(`Evicted ${toDelete} least used dependency cache entries`)
  }

  /**
   * 获取缓存统计信息
   */
  getCacheStats(): {
    functionCache: {
      size: number
      hitRate: number
      totalAccess: number
    }
    dependencyCache: {
      size: number
      hitRate: number
      totalAccess: number
    }
  } {
    const functionTotalAccess = Array.from(this.functionCache.values())
      .reduce((sum, cached) => sum + cached.accessCount, 0)

    const dependencyTotalAccess = Array.from(this.dependencyCache.values())
      .reduce((sum, cached) => sum + cached.accessCount, 0)

    return {
      functionCache: {
        size: this.functionCache.size,
        hitRate: functionTotalAccess > 0 ? (this.functionCache.size / functionTotalAccess) * 100 : 0,
        totalAccess: functionTotalAccess
      },
      dependencyCache: {
        size: this.dependencyCache.size,
        hitRate: dependencyTotalAccess > 0 ? (this.dependencyCache.size / dependencyTotalAccess) * 100 : 0,
        totalAccess: dependencyTotalAccess
      }
    }
  }

  /**
   * 预热缓存 - 加载常用函数
   */
  async warmupCache(functions: CloudFunction[]): Promise<void> {
    const now = new Date()

    for (const func of functions) {
      this.functionCache.set(func._id.toString(), {
        function: func,
        lastUpdated: now,
        accessCount: 0,
        lastAccessed: now
      })
    }

    this.logger.log(`Warmed up cache with ${functions.length} functions`)
  }

  /**
   * 清空所有缓存
   */
  clearAll(): void {
    const functionCount = this.functionCache.size
    const dependencyCount = this.dependencyCache.size

    this.functionCache.clear()
    this.dependencyCache.clear()

    this.logger.log(`Cleared all caches: ${functionCount} functions, ${dependencyCount} dependencies`)
  }

  /**
   * 获取热门函数（访问次数最多的函数）
   */
  getHotFunctions(limit: number = 10): Array<{ functionId: string; function: CloudFunction; accessCount: number }> {
    const entries = Array.from(this.functionCache.entries())

    return entries
      .sort((a, b) => b[1].accessCount - a[1].accessCount)
      .slice(0, limit)
      .map(([functionId, cached]) => ({
        functionId,
        function: cached.function,
        accessCount: cached.accessCount
      }))
  }
}