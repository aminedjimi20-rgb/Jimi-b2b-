import { Module } from '@nestjs/common';
import { ReturnsService } from './returns.service';
import { ReturnsController } from './returns.controller';
import { ReturnPdfService } from './return-pdf.service';

@Module({
  controllers: [ReturnsController],
  providers: [ReturnsService, ReturnPdfService],
})
export class ReturnsModule {}
