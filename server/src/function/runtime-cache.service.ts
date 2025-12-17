import { Injectable, Logger } from '@nestjs/common'
import { HttpService } from '@nestjs/axios'
import { firstValueFrom } from 'rxjs'

@Injectable()
export class RuntimeCacheService {
  private readonly logger = new Logger(RuntimeCacheService.name)

  constructor(private readonly httpService: HttpService) { }

  /**
   * 刷新运行时函数缓存
   */
  async refreshRuntimeCache(): Promise<boolean> {
    try {
      // 尝试多个可能的运行时端口
      const runtimePorts = [8000, 8001, 8002]

      for (const port of runtimePorts) {
        try {
          const response = await firstValueFrom(
            this.httpService.post(
              `http://localhost:${port}/_/refresh-cache`,
              {},
              {
                timeout: 5000,
                headers: {
                  'Content-Type': 'application/json',
                },
              },
            ),
          )

          if (response.status === 200) {
            this.logger.log(
              `Runtime cache refreshed successfully on port ${port}`,
            )
            return true
          }
        } catch (error) {
          this.logger.warn(
            `Failed to refresh cache on port ${port}: ${error.message}`,
          )
          continue
        }
      }

      this.logger.error('Failed to refresh runtime cache on all ports')
      return false
    } catch (error) {
      this.logger.error('Error refreshing runtime cache:', error)
      return false
    }
  }

  /**
   * 检查运行时健康状态
   */
  async checkRuntimeHealth(): Promise<{ port: number; healthy: boolean }[]> {
    const runtimePorts = [8000, 8001, 8002]
    const results = []

    for (const port of runtimePorts) {
      try {
        const response = await firstValueFrom(
          this.httpService.get(`http://localhost:${port}/_/healthz`, {
            timeout: 3000,
          }),
        )

        results.push({
          port,
          healthy: response.status === 200,
        })
      } catch (error) {
        results.push({
          port,
          healthy: false,
        })
      }
    }

    return results
  }
}
