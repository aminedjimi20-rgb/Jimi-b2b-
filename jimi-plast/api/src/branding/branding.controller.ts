import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { BrandingService } from './branding.service';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { AddPartnerLogoDto, SetCompanyInfoDto, SetExperienceYearsDto } from './dto/branding.dto';

/**
 * Image de marque affichée dans la barre latérale de toutes les pages —
 * lecture ouverte à tout compte connecté, écriture réservée à
 * settings.manage (l'admin uniquement, en pratique).
 */
@Controller('branding')
export class BrandingController {
  constructor(private readonly service: BrandingService) {}

  @Get()
  @RequirePermissions()
  get() {
    return this.service.get();
  }

  @Put('experience')
  @RequirePermissions('settings.manage')
  setExperience(@Body() dto: SetExperienceYearsDto) {
    return this.service.setExperienceYears(dto.experienceYears);
  }

  @Put('company')
  @RequirePermissions('settings.manage')
  setCompanyInfo(@Body() dto: SetCompanyInfoDto) {
    return this.service.setCompanyInfo(dto);
  }

  @Post('logos')
  @RequirePermissions('settings.manage')
  addLogo(@Body() dto: AddPartnerLogoDto) {
    return this.service.addLogo(dto.imageUrl);
  }

  @Delete('logos/:id')
  @RequirePermissions('settings.manage')
  removeLogo(@Param('id') id: string) {
    return this.service.removeLogo(id);
  }
}
