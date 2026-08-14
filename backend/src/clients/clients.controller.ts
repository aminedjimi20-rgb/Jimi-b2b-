import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user';
import { ClientsService } from './clients.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientStatusDto } from './dto/update-client-status.dto';

@Controller('clients')
export class ClientsController {
  constructor(private clientsService: ClientsService) {}

  @Roles('ADMIN')
  @Post()
  create(@Body() dto: CreateClientDto) {
    return this.clientsService.create(dto);
  }

  @Roles('ADMIN')
  @Get()
  findAll() {
    return this.clientsService.findAllForAdmin();
  }

  @Roles('ADMIN')
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.clientsService.findOneForAdmin(id);
  }

  @Roles('ADMIN')
  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body() dto: UpdateClientStatusDto) {
    return this.clientsService.setStatus(id, dto.status);
  }

  /** CLIENT-only — always resolves to the caller's own profile via the JWT, ignores any id in the URL. */
  @Roles('CLIENT')
  @Get('me/profile')
  getSelf(@CurrentUser() user: AuthenticatedUser) {
    return this.clientsService.findSelf(user.clientId!);
  }
}
