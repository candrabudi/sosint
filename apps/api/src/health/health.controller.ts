import { Controller, Get, Inject } from '@nestjs/common';
import type { Database } from '@sig/db';
import { sql } from 'drizzle-orm';
import { Public } from '../auth/decorators';
import { DB } from '../db/db.module';

@Public()
@Controller('health')
export class HealthController {
  constructor(@Inject(DB) private readonly db: Database) {}

  @Get()
  async check() {
    let database = 'up';
    try {
      await this.db.execute(sql`select 1`);
    } catch {
      database = 'down';
    }
    return { status: 'ok', database };
  }
}
