import { Controller, Get, Query } from '@nestjs/common';
import { type AnalyticsQueryPayload, analyticsQuerySchema } from '@sig/shared';
import { ZodValidationPipe } from '../zod-validation.pipe';
import { AnalyticsService } from './analytics.service';

@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly service: AnalyticsService) {}

  @Get('overview')
  overview(@Query(new ZodValidationPipe(analyticsQuerySchema)) query: AnalyticsQueryPayload) {
    return this.service.overview(query);
  }
}
