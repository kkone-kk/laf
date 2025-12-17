import { Injectable, Logger } from '@nestjs/common'
import * as fs from 'fs'
import * as path from 'path'
import { CloudFunction } from './entities/cloud-function'

export interface DependencyCheckResult {
  isComplete: boolean
  missingDependencies: string[]
  installedDependencies: string[]
  suggestions: string[]
}

export interface FunctionDependency {
  name: string
  version?: string
  required: boolean
}

@Injectable()
export class DependencyCheckerService {
  private readonly logger = new Logger(DependencyCheckerService.name)

  /**
   * 检查函数代码中的依赖
   */
  async checkFunctionDependencies(func: CloudFunction): Promise<DependencyCheckResult> {
    try {
      const code = func.source?.code || ''
      const detectedDependencies = this.extractDependenciesFromCode(code)
      const installedDependencies = await this.getInstalledDependencies()

      const missingDependencies = detectedDependencies.filter(
        dep => !installedDependencies.includes(dep.name)
      )

      const suggestions = this.generateSuggestions(detectedDependencies, installedDependencies)

      return {
        isComplete: missingDependencies.length === 0,
        missingDependencies: missingDependencies.map(dep => dep.name),
        installedDependencies: installedDependencies,
        suggestions
      }
    } catch (error) {
      this.logger.error('Failed to check function dependencies:', error)
      return {
        isComplete: false,
        missingDependencies: [],
        installedDependencies: [],
        suggestions: []
      }
    }
  }

  /**
   * 从函数代码中提取依赖
   */
  private extractDependenciesFromCode(code: string): FunctionDependency[] {
    const dependencies: FunctionDependency[] = []

    // 匹配 require() 语句
    const requireRegex = /require\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g
    let match

    while ((match = requireRegex.exec(code)) !== null) {
      const depName = match[1]

      // 跳过相对路径和内置模块
      if (!depName.startsWith('.') && !depName.startsWith('/') && !this.isBuiltinModule(depName)) {
        // 提取包名（去掉子路径）
        const packageName = depName.split('/')[0]
        if (packageName.startsWith('@')) {
          // 处理 scoped packages
          const scopedName = depName.split('/').slice(0, 2).join('/')
          dependencies.push({ name: scopedName, required: true })
        } else {
          dependencies.push({ name: packageName, required: true })
        }
      }
    }

    // 匹配 import 语句
    const importRegex = /import\s+.*?\s+from\s+['"`]([^'"`]+)['"`]/g
    while ((match = importRegex.exec(code)) !== null) {
      const depName = match[1]

      if (!depName.startsWith('.') && !depName.startsWith('/') && !this.isBuiltinModule(depName)) {
        const packageName = depName.split('/')[0]
        if (packageName.startsWith('@')) {
          const scopedName = depName.split('/').slice(0, 2).join('/')
          dependencies.push({ name: scopedName, required: true })
        } else {
          dependencies.push({ name: packageName, required: true })
        }
      }
    }

    // 去重
    const uniqueDeps = dependencies.filter((dep, index, self) =>
      index === self.findIndex(d => d.name === dep.name)
    )

    return uniqueDeps
  }

  /**
   * 检查是否为内置模块
   */
  private isBuiltinModule(moduleName: string): boolean {
    const builtinModules = [
      'fs', 'path', 'http', 'https', 'url', 'querystring', 'crypto', 'util',
      'events', 'stream', 'buffer', 'os', 'child_process', 'cluster', 'net',
      'tls', 'dgram', 'dns', 'readline', 'repl', 'vm', 'zlib', 'assert',
      'console', 'module', 'process', 'global', 'timers'
    ]
    return builtinModules.includes(moduleName)
  }

  /**
   * 获取已安装的依赖列表
   */
  private async getInstalledDependencies(): Promise<string[]> {
    try {
      // 检查运行时的 package.json
      const runtimePackageJsonPath = path.resolve(__dirname, '../../../runtimes/nodejs/package.json')

      if (fs.existsSync(runtimePackageJsonPath)) {
        const packageJson = JSON.parse(fs.readFileSync(runtimePackageJsonPath, 'utf8'))
        const dependencies = Object.keys(packageJson.dependencies || {})
        const devDependencies = Object.keys(packageJson.devDependencies || {})
        return [...dependencies, ...devDependencies]
      }

      return []
    } catch (error) {
      this.logger.error('Failed to get installed dependencies:', error)
      return []
    }
  }

  /**
   * 生成依赖建议
   */
  private generateSuggestions(detected: FunctionDependency[], installed: string[]): string[] {
    const suggestions: string[] = []

    // 常见依赖映射
    const commonMappings: Record<string, string> = {
      'axios': 'HTTP客户端库，用于发送HTTP请求',
      'lodash': '实用工具库，提供常用的数据处理函数',
      'moment': '日期时间处理库',
      'dayjs': '轻量级日期时间处理库',
      'uuid': 'UUID生成库',
      'bcrypt': '密码加密库',
      'jsonwebtoken': 'JWT令牌处理库',
      'validator': '数据验证库',
      'cheerio': 'HTML解析库，类似jQuery',
      'sharp': '图像处理库',
      'nodemailer': '邮件发送库',
      'socket.io': 'WebSocket实时通信库'
    }

    detected.forEach(dep => {
      if (!installed.includes(dep.name)) {
        const description = commonMappings[dep.name] || '第三方依赖包'
        suggestions.push(`${dep.name}: ${description}`)
      }
    })

    return suggestions
  }

  /**
   * 生成自动安装命令
   */
  generateInstallCommand(missingDependencies: string[]): string {
    if (missingDependencies.length === 0) {
      return ''
    }

    return `npm install ${missingDependencies.join(' ')}`
  }

  /**
   * 检查函数是否可以安全运行
   */
  async canFunctionRun(func: CloudFunction): Promise<{ canRun: boolean; reason?: string }> {
    const depCheck = await this.checkFunctionDependencies(func)

    if (!depCheck.isComplete) {
      return {
        canRun: false,
        reason: `缺少依赖: ${depCheck.missingDependencies.join(', ')}`
      }
    }

    // 检查代码语法（简单检查）
    try {
      const code = func.source?.code || ''
      if (code.trim().length === 0) {
        return {
          canRun: false,
          reason: '函数代码为空'
        }
      }

      // 基本语法检查
      if (this.hasBasicSyntaxErrors(code)) {
        return {
          canRun: false,
          reason: '代码存在语法错误'
        }
      }

      return { canRun: true }
    } catch (error) {
      return {
        canRun: false,
        reason: '代码检查失败'
      }
    }
  }

  /**
   * 基本语法错误检查
   */
  private hasBasicSyntaxErrors(code: string): boolean {
    try {
      // 检查括号匹配
      const brackets = { '(': ')', '[': ']', '{': '}' }
      const stack: string[] = []

      for (const char of code) {
        if (char in brackets) {
          stack.push(brackets[char])
        } else if (Object.values(brackets).includes(char)) {
          if (stack.pop() !== char) {
            return true
          }
        }
      }

      return stack.length > 0
    } catch (error) {
      return true
    }
  }
}