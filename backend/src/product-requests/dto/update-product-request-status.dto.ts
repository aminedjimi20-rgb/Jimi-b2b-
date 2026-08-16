import { IsIn, IsOptional, IsString } from 'class-validator';

/** ADMIN-only. */
export class UpdateProductRequestStatusDto {
  @IsIn(['TRAITEE', 'REJETEE'])
  status!: 'TRAITEE' | 'REJETEE';

  @IsOptional()
  @IsString()
  adminNote?: string;
}
