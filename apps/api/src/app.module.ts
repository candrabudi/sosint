import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AnalyticsModule } from './analytics/analytics.module';
import { DataUrlsModule } from './data-urls/data-urls.module';
import { DbModule } from './db/db.module';
import { HealthController } from './health/health.controller';
import { AuthModule } from './auth/auth.module';
import { SettingsModule } from './settings/settings.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['../../.env', '.env'] }),
    DbModule,
    AuthModule,
    SettingsModule,
    UsersModule,
    DataUrlsModule,
    AnalyticsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
