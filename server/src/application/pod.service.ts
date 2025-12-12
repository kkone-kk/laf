import { Injectable, Logger } from '@nestjs/common'
import { PodNameListDto, ContainerNameListDto } from './dto/pod.dto'
import { ProcessManagerService } from 'src/local-cluster/process-manager.service'

export type PodStatus = {
  appid: string
  podStatus: {
    name: string
    podStatus: string
    initContainerId?: string
  }[]
}
@Injectable()
export class PodService {
  private readonly logger = new Logger(PodService.name)

  constructor(
    private readonly processManager: ProcessManagerService,
  ) {}
  async getPodNameListByAppid(appid: string) {
    const process = this.processManager.getProcess(appid)
    const podNames: PodNameListDto = { appid: appid, podNameList: [] }
    if (process) {
      podNames.podNameList.push(appid) // Treat appid as pod name
    }
    return podNames
  }

  async getContainerNameListByPodName(appid: string, podName: string) {
    const containerNames: ContainerNameListDto = {
      podName: podName,
      containerNameList: ['main'],
    }
    return containerNames
  }

  async getPodStatusListByAppid(appid: string): Promise<PodStatus> {
    const process = this.processManager.getProcess(appid)
    const podStatus: PodStatus = {
      appid: appid,
      podStatus: [],
    }
    if (process) {
      podStatus.podStatus.push({
        name: appid,
        podStatus: 'Running',
        initContainerId: null,
      })
    }
    return podStatus
  }
}
