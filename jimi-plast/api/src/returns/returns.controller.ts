import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ReturnsService } from './returns.service';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { CreateReturnDto } from './dto/create-return.dto';
import { ValidateReturnDto } from './dto/validate-return.dto';

@Controller('returns')
@RequirePermissions('returns.manage')
export class ReturnsController {
  constructor(private readonly returnsService: ReturnsService) {}

  @Get()
  list(@Query('type') type?: string, @Query('status') status?: string) {
    return this.returnsService.list({ type, status });
  }

  @Get(':id')
  getById(@Param('id') id: string) {
    return this.returnsService.getById(id);
  }

  @Post()
  create(@Body() dto: CreateReturnDto, @CurrentUser() user: AuthenticatedUser) {
    return this.returnsService.create(dto, user.id);
  }

  @Post(':id/validate')
  validate(@Param('id') id: string, @Body() dto: ValidateReturnDto, @CurrentUser() user: AuthenticatedUser) {
    return this.returnsService.validate(id, dto, user.id);
  }

  @Post(':id/reject')
  reject(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.returnsService.reject(id, user.id);
  }
}
