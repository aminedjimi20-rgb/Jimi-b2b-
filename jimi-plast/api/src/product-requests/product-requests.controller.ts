import { Body, Controller, Get, Param, Post, Put } from '@nestjs/common';
import { ProductRequestsService } from './product-requests.service';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { CreateProductRequestDto } from './dto/create-product-request.dto';
import { UpdateProductRequestStatusDto } from './dto/update-product-request-status.dto';

@Controller('product-requests')
export class ProductRequestsController {
  constructor(private readonly service: ProductRequestsService) {}

  @Get()
  @RequirePermissions('requests.manage')
  list() {
    return this.service.list();
  }

  @Get('mine')
  mine(@CurrentUser() user: AuthenticatedUser) {
    return this.service.listForUser(user.id);
  }

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateProductRequestDto) {
    return this.service.create(user.id, dto);
  }

  @Put(':id/status')
  @RequirePermissions('requests.manage')
  updateStatus(@Param('id') id: string, @Body() dto: UpdateProductRequestStatusDto) {
    return this.service.updateStatus(id, dto);
  }
}
