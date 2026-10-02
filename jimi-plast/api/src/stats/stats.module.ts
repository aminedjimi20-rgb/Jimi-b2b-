import { Module } from '@nestjs/common';
import { StatsService } from './stats.service';
import { StatsController } from './stats.controller';
import { SituationPdfService } from './situation-pdf.service';

@Module({
  controllers: [StatsController],
  providers: [StatsService, SituationPdfService],
})
export class StatsModule {}
