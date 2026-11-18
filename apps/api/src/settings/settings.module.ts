import { Global, Module } from '@nestjs/common';
import { ApiDirectService } from '../integrations/apidirect.service';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';

/** Global: SettingsService & ApiDirectService bisa di-inject di modul mana pun. */
@Global()
@Module({
  controllers: [SettingsController],
  providers: [SettingsService, ApiDirectService],
  exports: [SettingsService, ApiDirectService],
})
export class SettingsModule {}
