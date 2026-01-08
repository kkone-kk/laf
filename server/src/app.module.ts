import { Module } from '@nestjs/common'
import { AppController } from './app.controller'
import { AppService } from './app.service'
import { FunctionModule } from './function/function.module'
import { HttpModule } from '@nestjs/axios'
import { ApplicationModule } from './application/application.module'
import { ThrottlerModule } from '@nestjs/throttler'
import { InitializerModule } from './initializer/initializer.module'
import { InstanceModule } from './instance/instance.module'
import { ScheduleModule } from '@nestjs/schedule'
import { DatabaseModule } from './database/database.module'
import { StorageModule } from './storage/storage.module'
import { LogModule } from './log/log.module'
import { DependencyModule } from './dependency/dependency.module'
import { TriggerModule } from './trigger/trigger.module'
import { RegionModule } from './region/region.module'
import { GatewayModule } from './gateway/gateway.module'
import { SettingModule } from './setting/setting.module'
import * as path from 'path'
import { AcceptLanguageResolver, I18nModule, QueryResolver } from 'nestjs-i18n'
import { MulterModule } from '@nestjs/platform-express'
import { ServerConfig } from './constants'
import { EventEmitterModule } from '@nestjs/event-emitter'
import { Module } from '@nestjs/common'
import { AppController } from './app.controller'
import { AppService } from './app.service'

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot({
      ttl: 60,
      limit: 10,
    }),
    FunctionModule,
    HttpModule,
    ApplicationModule,
    InitializerModule,
    InstanceModule,
    DatabaseModule,
    StorageModule,
    LogModule,
    DependencyModule,
    TriggerModule,
    RegionModule,
    GatewayModule,
    SettingModule,
    I18nModule.forRoot({
      fallbackLanguage: ServerConfig.DEFAULT_LANGUAGE,
      loaderOptions: {
        path: path.join(__dirname, '/i18n/'),
        watch: false,
      },
      resolvers: [
        { use: QueryResolver, options: ['lang'] },
        AcceptLanguageResolver,
      ],
      typesOutputPath: path.join(
        __dirname,
        '../src/generated/i18n.generated.ts',
      ),
    }),
    MulterModule.register(),
    EventEmitterModule.forRoot(),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
