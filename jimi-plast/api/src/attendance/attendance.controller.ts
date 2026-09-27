import { Body, Controller, Get, Post } from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { CreateEmployeeNoteDto } from './dto/employee-note.dto';

/** Pointage et journal personnel — en libre-service pour tout compte connecté,
 * chacun ne pointe et ne note que pour lui-même. La vue admin (par employé)
 * vit dans UsersController, réservée à users.manage. */
@Controller('attendance')
export class AttendanceController {
  constructor(private readonly service: AttendanceService) {}

  @Post('clock-in')
  clockIn(@CurrentUser() user: AuthenticatedUser) {
    return this.service.clockIn(user.id);
  }

  @Post('clock-out')
  clockOut(@CurrentUser() user: AuthenticatedUser) {
    return this.service.clockOut(user.id);
  }

  @Get('status')
  status(@CurrentUser() user: AuthenticatedUser) {
    return this.service.getOpenAttendance(user.id);
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
