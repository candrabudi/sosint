import { Body, Controller, Get, HttpCode, Post, Put } from '@nestjs/common';
import { type SyncScheduleInput, syncScheduleSchema } from '@sig/shared';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser, Roles } from '../auth/decorators';
import { ZodValidationPipe } from '../zod-validation.pipe';
import { SyncSchedulerService } from './sync-scheduler.service';

/** Pengaturan sinkron terjadwal — khusus admin. */
@Roles('admin')
@Controller('settings/sync-schedule')
export class SyncScheduleController {
  constructor(private readonly scheduler: SyncSchedulerService) {}

  @Get()
  get() {
    return this.scheduler.getPublic();
  }

  @Put()
  update(@Body(new ZodValidationPipe(syncScheduleSchema)) body: SyncScheduleInput, @CurrentUser() user: AuthUser) {
    return this.scheduler.update(body, user.id);
  }

  @Post('run')
  @HttpCode(202)
  run() {
    return this.scheduler.runNow();
  }
}
