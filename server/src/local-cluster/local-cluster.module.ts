import { Module } from '@nestjs/common'
import { ProcessManagerService } from './process-manager.service'
import { LocalGatewayService } from './local-gateway.service'

@Module({
  providers: [ProcessManagerService, LocalGatewayService],
  exports: [ProcessManagerService, LocalGatewayService],
})
export class LocalClusterModule {}
