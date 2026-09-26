import { Controller, Get, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { StatsService } from './stats.service';
import { SituationPdfService } from './situation-pdf.service';
import { RequirePermissions } from '../common/decorators/permissions.decorator';

@Controller('stats')
@RequirePermissions('stats.view')
export class StatsController {
  constructor(
    private readonly statsService: StatsService,
    private readonly situationPdfService: SituationPdfService,
  ) {}

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

  @Get('situation')
  situation(@Query('from') from?: string, @Query('to') to?: string) {
    return this.statsService.situation({ from, to });
  }

  @Get('situation/pdf')
  async situationPdf(@Query('from') from: string | undefined, @Query('to') to: string | undefined, @Res() res: Response) {
    const situation = await this.statsService.situation({ from, to });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="situation_${situation.from}_${situation.to}.pdf"`);
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    const doc = this.situationPdfService.generate(situation);
    doc.pipe(res);
  }
}
