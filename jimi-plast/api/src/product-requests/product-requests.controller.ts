import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ProductRequestsService } from './product-requests.service';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { CreateProductRequestDto } from './dto/create-product-request.dto';
import { UpdateProductRequestDto } from './dto/update-product-request.dto';
import { UpdateProductRequestStatusDto } from './dto/update-product-request-status.dto';
import { CreateRemarkDto, VoidRemarkDto } from './dto/remark.dto';

@Controller('product-requests')
export class ProductRequestsController {
  constructor(private readonly service: ProductRequestsService) {}

  @Get()
  @RequirePermissions('requests.manage')
  list(@Query('q') q?: string, @Query('status') status?: string) {
    return this.service.list({ q, status });
  }

  @Get('mine')
  mine(@CurrentUser() user: AuthenticatedUser) {
    return this.service.listForUser(user.id);
  }

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateProductRequestDto) {
    return this.service.create(user.id, dto);
  }

  @Put(':id')
  @RequirePermissions('requests.manage')
  update(@Param('id') id: string, @Body() dto: UpdateProductRequestDto) {
    return this.service.update(id, dto);
  }

  @Put(':id/status')
  @RequirePermissions('requests.manage')
  updateStatus(@Param('id') id: string, @Body() dto: UpdateProductRequestStatusDto) {
    return this.service.updateStatus(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('requests.manage')
  remove(@Param('id') id: string, @Query('reason') reason: string | undefined, @CurrentUser() user: AuthenticatedUser) {
    return this.service.remove(id, user.id, reason);
  }

  @Post(':id/remarks')
  @RequirePermissions('requests.manage')
  addRemark(@Param('id') id: string, @Body() dto: CreateRemarkDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.addRemark(id, dto.text, user.id);
  }

  @Put('remarks/:remarkId/void')
  @RequirePermissions('requests.manage')
  voidRemark(@Param('remarkId') remarkId: string, @Body() dto: VoidRemarkDto) {
    return this.service.voidRemark(remarkId, dto.voided ?? true);
  }
}
