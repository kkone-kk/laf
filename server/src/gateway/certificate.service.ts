import { Injectable, Logger } from '@nestjs/common'
import { ClusterService } from 'src/region/cluster/cluster.service'
import { Region } from 'src/region/entities/region'
import { WebsiteHosting } from 'src/website/entities/website'
import { RuntimeDomain } from './entities/runtime-domain'

// This class handles the creation and deletion of website domain certificates
@Injectable()
export class CertificateService {
  private readonly logger = new Logger(CertificateService.name)
  constructor(private readonly clusterService: ClusterService) {}

  getRuntimeCertificateName(domain: RuntimeDomain) {
    return `${domain.appid}-runtime-custom-domain`
  }

  getWebsiteCertificateName(website: WebsiteHosting) {
    return `${website._id.toString()}-website-custom`
  }

  async getWebsiteCertificate(region: Region, website: WebsiteHosting) {
    return null
  }

  async createWebsiteCertificate(region: Region, website: WebsiteHosting) {
    return {}
  }

  async deleteWebsiteCertificate(region: Region, website: WebsiteHosting) {
    return {}
  }

  async getRuntimeCertificate(region: Region, runtimeDomain: RuntimeDomain) {
    return null
  }

  async createRuntimeCertificate(region: Region, runtimeDomain: RuntimeDomain) {
    return {}
  }

  async deleteRuntimeCertificate(region: Region, runtimeDomain: RuntimeDomain) {
    return {}
  }
}
