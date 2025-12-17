import { Module } from '@nestjs/common'
import { ApplicationModule } from 'src/application/application.module'
import { DependencyController } from './dependency.controller'
import { DependencyService } from './dependency.service'
import { LocalClusterModule } from 'src/local-cluster/local-cluster.module'

@Module({
  imports: [ApplicationModule, LocalClusterModule],
  controllers: [DependencyController],
  providers: [DependencyService],
  exports: [DependencyService],
})
export class DependencyModule {}
