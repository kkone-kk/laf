import { Injectable, Logger } from '@nestjs/common'
import { Region } from '../entities/region'

@Injectable()
export class ClusterService {
  private readonly logger = new Logger(ClusterService.name)

  /**
   * Load kubeconfig of region:
   * - if region kubeconfig is empty, load from default config (in-cluster service account or ~/.kube/config)
   * - if region kubeconfig is not empty, load from string
   */
  loadKubeConfig(region: Region) {
    return {}
  }

  // create app namespace
  async createAppNamespace(region: Region, appid: string, userid: string) {
    return {}
  }

  // get app namespace
  async getAppNamespace(region: Region, appid: string) {
    return { metadata: { name: appid } }
  }

  // remove app namespace
  async removeAppNamespace(region: Region, appid: string) {
    return {}
  }

  async applyYamlString(region: Region, specString: string) {
    return []
  }

  async deleteYamlString(region: Region, specString: string) {
    return []
  }

  async patchCustomObject(region: Region, spec: any) {
    return {}
  }

  async deleteCustomObject(region: Region, spec: any) {
    return {}
  }

  async getIngress(region: Region, name: string, namespace: string) {
    return {}
  }

  async createIngress(region: Region, body: any) {
    return {}
  }

  async deleteIngress(region: Region, name: string, namespace: string) {
    return {}
  }

  makeCoreV1Api(region: Region) {
    return {}
  }

  makeAppsV1Api(region: Region) {
    return {}
  }

  makeBatchV1Api(region: Region) {
    return {}
  }

  makeObjectApi(region: Region) {
    return {}
  }

  makeCustomObjectApi(region: Region) {
    return {}
  }

  makeHorizontalPodAutoscalingV2Api(region: Region) {
    return {}
  }

  makeNetworkingApi(region: Region) {
    return {}
  }
}
