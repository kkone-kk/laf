import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common'
import * as child_process from 'child_process'
import * as path from 'path'
import * as fs from 'fs'

@Injectable()
export class ProcessManagerService implements OnModuleDestroy {
  private readonly logger = new Logger(ProcessManagerService.name)
  private processes: Map<string, child_process.ChildProcess> = new Map()
  private appPorts: Map<string, number> = new Map()

  // Start with 8000, but maybe dynamic allocation is better.
  // Actually, laf runtime listens on 8000 inside container.
  // Locally, we need to assign different ports.
  private nextPort = 10000

  constructor() {}

  async startProcess(appid: string, env: any) {
    if (this.processes.has(appid)) {
      this.logger.log(`Process for ${appid} already running`)
      return
    }

    const port = this.appPorts.get(appid) || this.nextPort++
    this.appPorts.set(appid, port)

    // Modify env to listen on assigned port
    // Filter out potential secrets from process.env if needed, but for now we just want to ensure we don't pass everything blindly if it causes issues.
    // However, Node process usually needs PATH etc.
    // We will keep process.env but be aware.
    // Actually, let's explicitely set what we need.
    const processEnv = { ...process.env, ...env, __PORT: port.toString() }

    // Locate runtime path
    // Assuming we are in server/src/...
    // We need to point to runtimes/nodejs
    // __dirname is server/src/local-cluster
    const runtimePath = path.resolve(__dirname, '../../../runtimes/nodejs')
    const distPath = path.join(runtimePath, 'dist/index.js')

    // Ensure runtime is built
    if (!fs.existsSync(distPath)) {
        this.logger.error(`Runtime not found at ${distPath}. Please build it first.`)
        throw new Error(`Runtime not found at ${distPath}`)
    }

    this.logger.log(`Starting process for ${appid} on port ${port}`)

    const child = child_process.spawn('node', [distPath], {
      env: processEnv,
      cwd: runtimePath, // Set CWD to runtime folder so it finds node_modules
      stdio: 'inherit' // Pipe output to parent
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
      // keeping port reservation for now
    }
  }

  getProcess(appid: string) {
      return this.processes.get(appid)
  }

  getPort(appid: string) {
      return this.appPorts.get(appid)
  }

  onModuleDestroy() {
    this.logger.log('ProcessManagerService destroying, killing all child processes...')
    for (const [appid, child] of this.processes) {
      this.logger.log(`Killing process for ${appid} (pid: ${child.pid})`)
      child.kill()
    }
    this.processes.clear()
  }
}
