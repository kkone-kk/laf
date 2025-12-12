import { Module } from '@nestjs/common'
import { ProcessManagerService } from './process-manager.service'
import { LocalGatewayService } from './local-gateway.service'
import { ProcessRecoveryService } from './process-recovery.service'
import { ApplicationModule } from 'src/application/application.module'

@Module({
  imports: [ApplicationModule],
  providers: [ProcessManagerService, LocalGatewayService, ProcessRecoveryService],
  exports: [ProcessManagerService, LocalGatewayService],
})
export class LocalClusterModule {}
