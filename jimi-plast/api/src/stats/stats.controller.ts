import { Controller, Get, Query } from '@nestjs/common';
import { StatsService } from './stats.service';
import { RequirePermissions } from '../common/decorators/permissions.decorator';

@Controller('stats')
@RequirePermissions('stats.view')
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  @Get('overview')
  overview() {
    return this.statsService.overview();
  }

  @Get('sales')
  sales(@Query('from') from?: string, @Query('to') to?: string) {
    return this.statsService.sales({ from, to });
  }

  @Get('margin')
  margin(@Query('from') from?: string, @Query('to') to?: string) {
    return this.statsService.margin({ from, to });
  }

  @Get('top-products')
  topProducts(@Query('from') from?: string, @Query('to') to?: string, @Query('limit') limit?: string) {
    return this.statsService.topProducts({ from, to }, limit ? Number(limit) : undefined);
  }

  @Get('credits')
  credits() {
    return this.statsService.credits();
  }
}
