import { Matches } from 'class-validator';

export class MarkAttendanceDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'date doit être au format YYYY-MM-DD' })
  date!: string;
}
