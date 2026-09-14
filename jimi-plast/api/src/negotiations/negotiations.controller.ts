import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { NegotiationsService } from './negotiations.service';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { CreateNegotiationDto } from './dto/create-negotiation.dto';
import { RespondNegotiationDto } from './dto/respond-negotiation.dto';

@Controller('negotiations')
export class NegotiationsController {
  constructor(private readonly service: NegotiationsService) {}

  @Get()
  @RequirePermissions('negotiations.manage')
  list() {
    return this.service.list();
  }

  @Get('mine')
  mine(@CurrentUser() user: AuthenticatedUser) {
    return this.service.listForUser(user.id);
  }

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateNegotiationDto) {
    return this.service.create(user.id, dto);
  }

  @Post(':id/respond')
  @RequirePermissions('negotiations.manage')
  respond(@Param('id') id: string, @Body() dto: RespondNegotiationDto) {
    return this.service.respond(id, dto);
  }
}
