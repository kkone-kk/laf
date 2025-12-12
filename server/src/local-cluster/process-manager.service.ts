import { Injectable, Logger } from '@nestjs/common'
import * as child_process from 'child_process'
import * as path from 'path'
import * as fs from 'fs'

@Injectable()
export class ProcessManagerService {
  private readonly logger = new Logger(ProcessManagerService.name)
  private processes: Map<string, child_process.ChildProcess> = new Map()
  private appPorts: Map<string, number> = new Map()

  // Start with 10000
  private nextPort = 10000

  constructor() {}

  async startProcess(appid: string, env: any) {
    if (this.processes.has(appid)) {
      this.logger.log(`Process for ${appid} already running`)
      return { pid: this.processes.get(appid).pid, port: this.appPorts.get(appid) }
    }

    let port = this.appPorts.get(appid)
    if (!port) {
      port = this.nextPort++
      this.appPorts.set(appid, port)
    }

    // Shared runtime path
    const sharedRuntimePath = path.resolve(__dirname, '../../../runtimes/node-shared')
    const runtimePath = path.resolve(__dirname, '../../../runtimes/nodejs')
    const distPath = path.join(runtimePath, 'dist/index.js')

     // Ensure runtime is built
    if (!fs.existsSync(distPath)) {
        this.logger.error(`Runtime not found at ${distPath}. Please build it first.`)
        throw new Error(`Runtime not found at ${distPath}`)
    }

    // Prepare shared environment
    const processEnv = {
      ...process.env,
      ...env,
      __PORT: port.toString(),
      // Force node to look in shared modules if needed, though CWD usually handles it
      // NODE_PATH: path.join(sharedRuntimePath, 'node_modules')
    }

    this.logger.log(`Starting process for ${appid} on port ${port} with shared runtime`)

    // We run the code from 'runtimes/nodejs/dist/index.js'
    // BUT we set CWD to 'runtimes/node-shared' so it picks up the shared node_modules
    const child = child_process.spawn('node', [distPath], {
      env: processEnv,
      cwd: sharedRuntimePath,
      stdio: 'inherit'
    })

    this.processes.set(appid, child)

    child.on('exit', (code) => {
      this.logger.log(`Process ${appid} exited with code ${code}`)
      this.processes.delete(appid)
    })

    return { pid: child.pid, port }
  }

  async stopProcess(appid: string) {
    const child = this.processes.get(appid)
    if (child) {
      child.kill()
      this.processes.delete(appid)
    }
  }

  getProcess(appid: string) {
      return this.processes.get(appid)
  }

  getPort(appid: string) {
      return this.appPorts.get(appid)
  }

  async reloadProcess(appid: string, env: any) {
    await this.stopProcess(appid)
    return await this.startProcess(appid, env)
  }
}
