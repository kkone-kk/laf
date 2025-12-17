import { Injectable, Logger } from '@nestjs/common'

export interface CacheEntry<T> {
  data: T
  timestamp: number
  ttl: number
  hits: number
}

export interface CacheStats {
  totalEntries: number
  totalHits: number
  totalMisses: number
  hitRate: number
  memoryUsage: number
}

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name)
  private cache = new Map<string, CacheEntry<any>>()
  private stats = {
    totalHits: 0,
    totalMisses: 0
  }

  private readonly defaultTTL = parseInt(process.env.CACHE_DEFAULT_TTL || '300000') // 5 minutes
  private readonly maxEntries = parseInt(process.env.CACHE_MAX_ENTRIES || '1000')
  private cleanupInterval: NodeJS.Timeout

  constructor() {
    // Clean up expired entries every minute
    this.cleanupInterval = setInterval(() => {
      this.cleanup()
    }, 60000)
  }

  /**
   * Get value from cache
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key)

    if (!entry) {
      this.stats.totalMisses++
      return null
    }

    // Check if expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key)
      this.stats.totalMisses++
      return null
    }

    // Update hit count
    entry.hits++
    this.stats.totalHits++

    return entry.data
  }

  /**
   * Set value in cache
   */
  set<T>(key: string, value: T, ttl?: number): void {
    // Check if we need to make room
    if (this.cache.size >= this.maxEntries) {
      this.evictLeastUsed()
    }

    const entry: CacheEntry<T> = {
      data: value,
      timestamp: Date.now(),
      ttl: ttl || this.defaultTTL,
      hits: 0
    }

    this.cache.set(key, entry)
  }

  /**
   * Delete value from cache
   */
  delete(key: string): boolean {
    return this.cache.delete(key)
  }

  /**
   * Check if key exists in cache
   */
  has(key: string): boolean {
    const entry = this.cache.get(key)

    if (!entry) {
      return false
    }

    // Check if expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key)
      return false
    }

    return true
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear()
    this.stats.totalHits = 0
    this.stats.totalMisses = 0
    this.logger.log('Cache cleared')
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const totalRequests = this.stats.totalHits + this.stats.totalMisses
    const hitRate = totalRequests > 0 ? (this.stats.totalHits / totalRequests) * 100 : 0

    // Estimate memory usage (rough calculation)
    let memoryUsage = 0
    for (const [key, entry] of this.cache.entries()) {
      memoryUsage += key.length * 2 // UTF-16 characters
      memoryUsage += JSON.stringify(entry.data).length * 2
      memoryUsage += 64 // Overhead for entry object
    }

    return {
      totalEntries: this.cache.size,
      totalHits: this.stats.totalHits,
      totalMisses: this.stats.totalMisses,
      hitRate: Math.round(hitRate * 100) / 100,
      memoryUsage
    }
  }

  /**
   * Get or set pattern - useful for caching expensive operations
   */
  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    const cached = this.get<T>(key)

    if (cached !== null) {
      return cached
    }

    const value = await factory()
    this.set(key, value, ttl)

    return value
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = Date.now()
    let cleanedCount = 0

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key)
        cleanedCount++
      }
    }

    if (cleanedCount > 0) {
      this.logger.debug(`Cleaned up ${cleanedCount} expired cache entries`)
    }
  }

  /**
   * Evict least recently used entries when cache is full
   */
  private evictLeastUsed(): void {
    let leastUsedKey: string | null = null
    let leastHits = Infinity
    let oldestTimestamp = Infinity

    for (const [key, entry] of this.cache.entries()) {
      // Prefer entries with fewer hits, then older entries
      if (entry.hits < leastHits || (entry.hits === leastHits && entry.timestamp < oldestTimestamp)) {
        leastUsedKey = key
        leastHits = entry.hits
        oldestTimestamp = entry.timestamp
      }
    }

    if (leastUsedKey) {
      this.cache.delete(leastUsedKey)
      this.logger.debug(`Evicted least used cache entry: ${leastUsedKey}`)
    }
  }

  /**
   * Generate cache key from object
   */
  generateKey(prefix: string, params: any): string {
    const paramString = typeof params === 'string' ? params : JSON.stringify(params)
    return `${prefix}:${paramString}`
  }

  /**
   * Cleanup on service destroy
   */
  onModuleDestroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
    }
  }
}