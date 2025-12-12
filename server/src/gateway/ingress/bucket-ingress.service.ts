import { Injectable, Logger } from '@nestjs/common'
import { Region } from 'src/region/entities/region'
import { BucketDomain } from '../entities/bucket-domain'

@Injectable()
export class BucketGatewayService {
  private readonly logger = new Logger(BucketGatewayService.name)
  constructor() {}

  getIngressName(bucketDomain: BucketDomain) {
    return bucketDomain._id.toString()
  }

  async getIngress(region: Region, domain: BucketDomain) {
     return {
        spec: {
            rules: [{
                host: domain.domain
            }]
        }
    }
  }

  async createIngress(region: Region, domain: BucketDomain) {
    this.logger.log(`Bucket Ingress "created" for ${domain.domain}`)
    return {}
  }

  async deleteIngress(region: Region, domain: BucketDomain) {
    this.logger.log(`Bucket Ingress deleted for ${domain.domain}`)
    return {}
  }
}
