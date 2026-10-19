import {
  Controller,
  Get,
  Inject,
  ServiceUnavailableException,
} from '@nestjs/common';
import { DatabaseService } from './database.service';

@Controller('health')
export class HealthController {
  constructor(
    @Inject(DatabaseService)
    private readonly database: Pick<DatabaseService, 'isReady'>,
  ) {}

  @Get('live')
  live() {
    return { status: 'ok', service: 'api', stage: 'foundation' };
  }

  @Get('ready')
  async ready() {
    if (!(await this.database.isReady())) {
      throw new ServiceUnavailableException({ status: 'not_ready' });
    }
    return { status: 'ready', checks: { database: 'ok' } };
  }
}
