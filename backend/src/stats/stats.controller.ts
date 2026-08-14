import { Controller, Get, Query } from '@nestjs/common';
import { Roles } from '../common/decorators/roles.decorator';
import { StatsService } from './stats.service';
import { StatsQueryDto } from './dto/stats-query.dto';

@Roles('ADMIN')
@Controller('stats')
export class StatsController {
  constructor(private statsService: StatsService) {}

  @Get('dashboard')
  dashboard(@Query() query: StatsQueryDto) {
    return this.statsService.dashboard(query);
  }
}
