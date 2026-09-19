import { Body, Controller, Delete, Get, Param, Post, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ReturnsService } from './returns.service';
import { ReturnPdfService } from './return-pdf.service';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { CreateReturnDto } from './dto/create-return.dto';
import { ValidateReturnDto } from './dto/validate-return.dto';
import { AddReturnAttachmentDto } from './dto/add-return-attachment.dto';

@Controller('returns')
@RequirePermissions('returns.manage')
export class ReturnsController {
  constructor(
    private readonly returnsService: ReturnsService,
    private readonly pdfService: ReturnPdfService,
  ) {}

  @Get()
  list(@Query('type') type?: string, @Query('status') status?: string) {
    return this.returnsService.list({ type, status });
  }

  @Get(':id')
  getById(@Param('id') id: string) {
    return this.returnsService.getById(id);
  }

  @Get(':id/history')
  history(@Param('id') id: string) {
    return this.returnsService.history(id);
  }

  @Get(':id/pdf')
  async pdf(@Param('id') id: string, @Res() res: Response) {
    const ret = await this.returnsService.getById(id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${ret.number ?? ret.id}.pdf"`);
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    const doc = this.pdfService.generate(ret as never);
    doc.pipe(res);
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

  @Post(':id/attachments')
  addAttachment(@Param('id') id: string, @Body() dto: AddReturnAttachmentDto) {
    return this.returnsService.addAttachment(id, dto.url);
  }

  @Delete(':id/attachments/:attachmentId')
  removeAttachment(@Param('id') id: string, @Param('attachmentId') attachmentId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.returnsService.removeAttachment(id, attachmentId, user.id);
  }

  @Post(':id/items/:itemId/images')
  addItemImage(@Param('id') id: string, @Param('itemId') itemId: string, @Body() dto: AddReturnAttachmentDto) {
    return this.returnsService.addItemImage(id, itemId, dto.url);
  }

  @Delete(':id/items/:itemId/images/:imageId')
  removeItemImage(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Param('imageId') imageId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.returnsService.removeItemImage(id, itemId, imageId, user.id);
  }
}
