import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { RegistrationStatus } from '@prisma/client';
import { RegistrationRequestsService } from './registration-requests.service';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { AcceptRegistrationRequestDto } from './dto/accept-request.dto';
import { ReviewNoteDto } from './dto/review-note.dto';

@Controller('registration-requests')
@RequirePermissions('users.manage')
export class RegistrationRequestsController {
  constructor(private readonly service: RegistrationRequestsService) {}

  @Get()
  list(@Query('status') status?: RegistrationStatus) {
    return this.service.list(status);
  }

  @Post(':id/accept')
  accept(
    @Param('id') id: string,
    @Body() dto: AcceptRegistrationRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.accept(id, dto, user.id);
  }

  @Post(':id/reject')
  reject(@Param('id') id: string, @Body() dto: ReviewNoteDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.reject(id, dto.reviewNote, user.id);
  }

  @Post(':id/request-info')
  requestInfo(@Param('id') id: string, @Body() dto: ReviewNoteDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.requestInfo(id, dto.reviewNote, user.id);
  }
}
