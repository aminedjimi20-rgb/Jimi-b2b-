import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { UsersService } from './users.service';
import { AttendanceService } from '../attendance/attendance.service';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { SetUserStatusDto } from './dto/set-user-status.dto';
import { SetUserPermissionsDto } from './dto/set-user-permissions.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { CreateEmployeeNoteDto, VoidEmployeeNoteDto } from '../attendance/dto/employee-note.dto';
import { SetAvatarDto } from '../auth/dto/set-avatar.dto';

@Controller('users')
@RequirePermissions('users.manage')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly attendanceService: AttendanceService,
  ) {}

  @Get()
  list() {
    return this.usersService.list();
  }

  @Get(':id')
  getById(@Param('id') id: string) {
    return this.usersService.getById(id);
  }

  @Post()
  create(@Body() dto: CreateUserDto, @CurrentUser() user: AuthenticatedUser) {
    return this.usersService.create(dto, user.id);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateUserDto, @CurrentUser() user: AuthenticatedUser) {
    return this.usersService.update(id, dto, user.id);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Query('reason') reason: string | undefined, @CurrentUser() user: AuthenticatedUser) {
    return this.usersService.remove(id, user.id, reason);
  }

  @Put(':id/status')
  setStatus(
    @Param('id') id: string,
    @Body() dto: SetUserStatusDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.usersService.setStatus(id, dto, user.id);
  }

  @Put(':id/avatar')
  setAvatar(@Param('id') id: string, @Body() dto: SetAvatarDto) {
    return this.usersService.setAvatar(id, dto.avatarUrl);
  }

  @Get(':id/permissions')
  getPermissions(@Param('id') id: string) {
    return this.usersService.getPermissions(id);
  }

  @Put(':id/permissions')
  setPermissions(
    @Param('id') id: string,
    @Body() dto: SetUserPermissionsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.usersService.setPermissions(id, dto, user.id);
  }

  @Get(':id/activity')
  getActivity(@Param('id') id: string) {
    return this.attendanceService.getActivity(id);
  }

  // Le calendrier vu par l'administrateur est exactement le même que celui
  // de l'employé (getCalendar) — seule la confirmation lui est réservée.
  @Get(':id/attendance')
  getAttendanceCalendar(@Param('id') id: string) {
    return this.attendanceService.getCalendar(id);
  }

  @Post(':id/attendance/:date/confirm')
  confirmAttendance(@Param('id') id: string, @Param('date') date: string, @CurrentUser() user: AuthenticatedUser) {
    return this.attendanceService.confirm(user.id, id, date);
  }

  @Post(':id/attendance/:date/unconfirm')
  unconfirmAttendance(@Param('id') id: string, @Param('date') date: string) {
    return this.attendanceService.unconfirm(id, date);
  }

  @Put(':id/attendance/:attendanceId/hidden')
  setAttendanceHidden(@Param('attendanceId') attendanceId: string, @Body('hidden') hidden: boolean) {
    return this.attendanceService.setHidden(attendanceId, hidden);
  }

  @Post(':id/notes')
  addNote(@Param('id') id: string, @Body() dto: CreateEmployeeNoteDto, @CurrentUser() user: AuthenticatedUser) {
    return this.attendanceService.addNote(id, dto.text, user.id);
  }

  @Put('notes/:noteId/void')
  voidNote(@Param('noteId') noteId: string, @Body() dto: VoidEmployeeNoteDto) {
    return this.attendanceService.voidNote(noteId, dto.voided ?? true);
  }
}
