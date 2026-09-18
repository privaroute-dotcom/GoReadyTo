import { Controller, Get } from '@nestjs/common';
import { DbService } from '../db/db.service';

@Controller('v1/health')
export class HealthController {
  constructor(private readonly db: DbService) {}

  @Get()
  async health() {
    const result = await this.db.query<{ now: string }>('SELECT now()::text AS now');
    return {
      ok: true,
      service: 'goreadyto-api',
      database: 'ok',
      serverTime: result.rows[0].now,
    };
  }
}
