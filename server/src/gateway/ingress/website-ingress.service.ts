import { Injectable, Logger } from '@nestjs/common'
import { Region } from 'src/region/entities/region'
import { WebsiteHosting } from 'src/website/entities/website'

@Injectable()
export class WebsiteHostingGatewayService {
  private readonly logger = new Logger(WebsiteHostingGatewayService.name)

  constructor() {}

  getIngressName(websiteHosting: WebsiteHosting) {
    return websiteHosting._id.toString()
  }

  async getIngress(region: Region, website: WebsiteHosting) {
    // Mock return
    return {
        spec: {
            rules: [{
                host: website.domain
            }]
        }
    }
  }

  async createIngress(region: Region, website: WebsiteHosting) {
    this.logger.log(`Website Ingress "created" for ${website.domain}`)
    return {}
  }

  async deleteIngress(region: Region, website: WebsiteHosting) {
    this.logger.log(`Website Ingress deleted for ${website.domain}`)
    return {}
  }
}
