import { Injectable, Logger } from '@nestjs/common'
import { Region } from 'src/region/entities/region'
import { RuntimeDomain } from '../entities/runtime-domain'
import { ProcessManagerService } from 'src/local-cluster/process-manager.service'

@Injectable()
export class RuntimeGatewayService {
  private readonly logger = new Logger(RuntimeGatewayService.name)
  constructor(
    private readonly processManager: ProcessManagerService,
  ) {}

  getIngressName(domain: RuntimeDomain) {
    return domain.appid
  }

  async getIngress(region: Region, domain: RuntimeDomain) {
    const appid = domain.appid
    const port = this.processManager.getPort(appid)
    if (!port) return null
    return {
        spec: {
            rules: [{
                host: domain.domain
            }]
        }
    }
  }

  async createIngress(region: Region, runtimeDomain: RuntimeDomain) {
    // In local mode, ingress creation is implied by process creation and routing logic (which we haven't implemented yet, but for now we assume port mapping is enough if we had a reverse proxy)
    // We can just log this.
    this.logger.log(`Ingress "created" for ${runtimeDomain.appid} domain ${runtimeDomain.domain}`)
    return {}
  }

  async deleteIngress(region: Region, domain: RuntimeDomain) {
    this.logger.log(`Ingress deleted for ${domain.appid}`)
    return {}
  }
}
