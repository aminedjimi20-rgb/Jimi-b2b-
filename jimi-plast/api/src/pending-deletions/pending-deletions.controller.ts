import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { PendingDeletionsService } from './pending-deletions.service';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { RespondDeletionDto } from './dto/respond-deletion.dto';

@Controller('pending-deletions')
export class PendingDeletionsController {
  constructor(private readonly service: PendingDeletionsService) {}

  @Get()
  @RequirePermissions('customers.manage')
  list() {
    return this.service.listAll();
  }

  @Get('mine')
  mine(@CurrentUser() user: AuthenticatedUser) {
    return this.service.listMine(user.id);
  }

  @Post(':id/respond')
  respond(@Param('id') id: string, @Body() dto: RespondDeletionDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.respond(id, dto.decision, user.id);
  }
}
