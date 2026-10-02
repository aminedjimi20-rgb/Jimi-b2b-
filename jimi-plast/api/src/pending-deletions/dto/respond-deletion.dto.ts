import { IsIn } from 'class-validator';

export class RespondDeletionDto {
  @IsIn(['APPROVED', 'REJECTED'])
  decision!: 'APPROVED' | 'REJECTED';
}
