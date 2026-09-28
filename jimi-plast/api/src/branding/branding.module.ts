import { Module } from '@nestjs/common';
import { BrandingService } from './branding.service';
import { BrandingController } from './branding.controller';

@Module({
  controllers: [BrandingController],
  providers: [BrandingService],
})
export class BrandingModule {}
