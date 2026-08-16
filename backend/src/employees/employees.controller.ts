import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { Roles } from '../common/decorators/roles.decorator';
import { EmployeesService } from './employees.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { UpdateEmployeeStatusDto } from './dto/update-employee-status.dto';

@Controller('employees')
@Roles('ADMIN')
export class EmployeesController {
  constructor(private employeesService: EmployeesService) {}

  @Post()
  create(@Body() dto: CreateEmployeeDto) {
    return this.employeesService.create(dto);
  }

  @Get()
  findAll() {
    return this.employeesService.findAllForAdmin();
  }

  // Must come before ':id' so "trash" isn't swallowed as an id param.
  @Get('trash')
  findTrash() {
    return this.employeesService.findTrash();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.employeesService.findOneForAdmin(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateEmployeeDto) {
    return this.employeesService.update(id, dto);
  }

  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body() dto: UpdateEmployeeStatusDto) {
    return this.employeesService.setStatus(id, dto.status);
  }

  // Moves to the corbeille (reversible, also suspends login) — see DELETE :id/permanent to erase for good.
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.employeesService.remove(id);
  }

  @Post(':id/restore')
  restore(@Param('id') id: string) {
    return this.employeesService.restore(id);
  }

  @Delete(':id/permanent')
  permanentDelete(@Param('id') id: string) {
    return this.employeesService.permanentDelete(id);
  }
}
