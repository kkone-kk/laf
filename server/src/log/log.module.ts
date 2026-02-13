import { Module } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { DatabaseModule } from 'src/database/database.module'
import { FunctionModule } from 'src/function/function.module'
import { ApplicationModule } from '../application/application.module'
import { LogController } from './log.controller'
import { LocalClusterModule } from 'src/local-cluster/local-cluster.module'

@Module({
  imports: [ApplicationModule, FunctionModule, DatabaseModule, LocalClusterModule],
  controllers: [LogController],
  providers: [JwtService],
})
export class LogModule {}
