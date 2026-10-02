import { Controller, Get } from '@nestjs/common';
import { CatalogSettingsService } from './catalog-settings.service';
import { Public } from '../common/decorators/public.decorator';

@Controller('catalog-settings')
export class CatalogSettingsController {
  constructor(private readonly service: CatalogSettingsService) {}

  @Public()
  @Get('packaging-units')
  packagingUnits() {
    return this.service.listPackagingUnits();
  }

  @Public()
  @Get('price-tier-types')
  priceTierTypes() {
    return this.service.listPriceTierTypes();
  }
}
