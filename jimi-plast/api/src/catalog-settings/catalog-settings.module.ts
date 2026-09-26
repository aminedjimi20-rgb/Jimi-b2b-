import { Module } from '@nestjs/common';
import { CatalogSettingsService } from './catalog-settings.service';
import { CatalogSettingsController } from './catalog-settings.controller';

@Module({
  controllers: [CatalogSettingsController],
  providers: [CatalogSettingsService],
  exports: [CatalogSettingsService],
})
export class CatalogSettingsModule {}
