import { Body, Controller, Get, Param, Post, Put } from '@nestjs/common';
import { BesoinsService } from './besoins.service';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { CreateBesoinDto } from './dto/create-besoin.dto';
import { RespondBesoinDto } from './dto/respond-besoin.dto';

/**
 * "Besoin" : tout utilisateur connecté (employé, grossiste, détaillant)
 * peut signaler un besoin lié aux dépôts. Chacun ne voit que ses propres
 * messages (/mine) ; seule la permission besoins.manage donne accès à la
 * liste complète avec auteur, et au droit de répondre.
 */
@Controller('besoins')
export class BesoinsController {
  constructor(private readonly besoinsService: BesoinsService) {}

  @Post()
  create(@Body() dto: CreateBesoinDto, @CurrentUser() user: AuthenticatedUser) {
    return this.besoinsService.create(user.id, user.fullName, dto);
  }

  @Get('mine')
  mine(@CurrentUser() user: AuthenticatedUser) {
    return this.besoinsService.mine(user.id);
  }

  @Get()
  @RequirePermissions('besoins.manage')
  all() {
    return this.besoinsService.all();
  }

  @Put(':id/respond')
  @RequirePermissions('besoins.manage')
  respond(@Param('id') id: string, @Body() dto: RespondBesoinDto, @CurrentUser() user: AuthenticatedUser) {
    return this.besoinsService.respond(id, user.id, dto);
  }
}
