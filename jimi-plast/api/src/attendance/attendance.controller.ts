import { Body, Controller, Get, Param, Post, Put } from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { CreateEmployeeNoteDto } from './dto/employee-note.dto';
import { MarkAttendanceDto } from './dto/mark-attendance.dto';

/** Pointage-calendrier et journal personnel — en libre-service pour tout
 * compte connecté, chacun ne coche/ne note que pour lui-même. La vue admin
 * (par employé, avec confirmation) vit dans UsersController, réservée à
 * users.manage. */
@Controller('attendance')
export class AttendanceController {
  constructor(private readonly service: AttendanceService) {}

  @Get('calendar')
  calendar(@CurrentUser() user: AuthenticatedUser) {
    return this.service.getCalendar(user.id);
  }

  @Post('mark')
  mark(@CurrentUser() user: AuthenticatedUser, @Body() dto: MarkAttendanceDto) {
    return this.service.mark(user.id, dto.date);
  }

  @Post('unmark')
  unmark(@CurrentUser() user: AuthenticatedUser, @Body() dto: MarkAttendanceDto) {
    return this.service.unmark(user.id, dto.date);
  }

  @Put(':id/hidden')
  setHidden(@Param('id') id: string, @Body('hidden') hidden: boolean, @CurrentUser() user: AuthenticatedUser) {
    return this.service.setHiddenMine(user.id, id, hidden);
  }

  @Get('mine')
  mine(@CurrentUser() user: AuthenticatedUser) {
    return this.service.getActivity(user.id);
  }

  @Post('notes')
  addNote(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateEmployeeNoteDto) {
    return this.service.addNote(user.id, dto.text, user.id);
  }
}
