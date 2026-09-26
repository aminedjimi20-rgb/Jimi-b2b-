import { IsOptional, IsString } from 'class-validator';

export class DeleteReturnDto {
  @IsOptional()
  @IsString()
  reason?: string;
}
