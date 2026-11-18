import { Module } from '@nestjs/common';
import { DataUrlsController } from './data-urls.controller';
import { DataUrlsService } from './data-urls.service';
import { SyncScheduleController } from './sync-schedule.controller';
import { SyncSchedulerService } from './sync-scheduler.service';

@Module({
  controllers: [DataUrlsController, SyncScheduleController],
  providers: [DataUrlsService, SyncSchedulerService],
})
export class DataUrlsModule {}
