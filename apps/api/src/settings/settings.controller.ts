import { Body, Controller, Get, HttpCode, Post, Put } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  type TestApiDirectInput, testApiDirectSchema, type UpdateApiDirectSettingsPayload, updateApiDirectSettingsSchema,
} from '@sig/shared';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser, Roles } from '../auth/decorators';
import { ApiDirectService } from '../integrations/apidirect.service';
import { ZodValidationPipe } from '../zod-validation.pipe';
import { SettingsService } from './settings.service';

/** Pengaturan integrasi — khusus admin. */
@Roles('admin')
@Controller('settings')
export class SettingsController {
  constructor(
    private readonly settings: SettingsService,
    private readonly apidirect: ApiDirectService,
  ) {}

  @Get('apidirect')
  getApiDirect() {
    return this.settings.getApiDirectPublic();
  }

  @Put('apidirect')
  updateApiDirect(
    @Body(new ZodValidationPipe(updateApiDirectSettingsSchema)) body: UpdateApiDirectSettingsPayload,
    @CurrentUser() user: AuthUser,
  ) {
    return this.settings.updateApiDirect(body, user.id);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('apidirect/test')
  @HttpCode(200)
  testApiDirect(@Body(new ZodValidationPipe(testApiDirectSchema)) body: TestApiDirectInput) {
    return this.apidirect.testConnection(body);
  }
}
