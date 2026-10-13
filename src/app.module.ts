import { BullModule, type BullRootModuleOptions } from '@nestjs/bullmq';
import { type DynamicModule, Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard } from '@nestjs/throttler';
import { type AppModuleOptions } from './bootstrap';
import { CacheModule } from './common/cache';
import { AllExceptionsFilter } from './common/filters';
import { JwtAuthGuard, RolesGuard } from './common/guards';
import { RequestLoggingInterceptor } from './common/interceptors';
import { LifecycleModule } from './common/lifecycle';
import { ThrottlingModule } from './common/throttling';
import { AppConfigService } from './config/app-config.service';
import { AppConfigModule } from './config/config.module';
import { DatabaseModule } from './database';
import { ApplicationsModule } from './modules/applications/applications.module';
import { AuditModule } from './modules/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { HealthModule } from './modules/health/health.module';
import { RiskWorkerModule } from './modules/risk/risk-worker.module';
import { RiskModule } from './modules/risk/risk.module';
import { UsersModule } from './modules/users/users.module';

@Module({})
export class AppModule {
  public static register(options: AppModuleOptions): DynamicModule {
    return {
      module: AppModule,
      imports: [
        AppConfigModule,
        LifecycleModule,
        DatabaseModule,
        BullModule.forRootAsync({
          inject: [AppConfigService],
          useFactory: (config: AppConfigService): BullRootModuleOptions => ({
            connection: config.redis,
            prefix: config.queuePrefix,
          }),
        }),
        CacheModule,
        ThrottlingModule,
        HealthModule,
        AuditModule,
        UsersModule,
        AuthModule,
        RiskModule,
        ApplicationsModule,
        ...(options.withWorker ? [RiskWorkerModule] : []),
      ],
      providers: [
        { provide: APP_GUARD, useClass: ThrottlerGuard },
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        { provide: APP_GUARD, useClass: RolesGuard },
        { provide: APP_INTERCEPTOR, useClass: RequestLoggingInterceptor },
        { provide: APP_FILTER, useClass: AllExceptionsFilter },
      ],
    };
  }
}
