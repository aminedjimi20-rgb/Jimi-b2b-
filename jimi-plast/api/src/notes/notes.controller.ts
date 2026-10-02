import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import { NotesService } from './notes.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { CreateNoteDto, SetNoteHiddenDto } from './dto/note.dto';

/** Bloc-notes personnel — libre-service, chacun ne voit et ne gère que ses
 * propres notes (pas de permission particulière, comme Besoins). */
@Controller('notes')
export class NotesController {
  constructor(private readonly service: NotesService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Query('q') q: string | undefined, @Query('includeHidden') includeHidden: string | undefined) {
    return this.service.list(user.id, { q, includeHidden: includeHidden === 'true' });
  }

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateNoteDto) {
    return this.service.create(user.id, dto.text);
  }

  @Put(':id/hide')
  setHidden(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser, @Body() dto: SetNoteHiddenDto) {
    return this.service.setHidden(id, user.id, dto.hidden ?? true);
  }
}
