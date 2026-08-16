import { IsOptional, IsString, MinLength } from 'class-validator';

/** CLIENT-only: `imageUrl` comes from POST /uploads/request-photo (see UploadsController). */
export class CreateProductRequestDto {
  @IsString()
  @MinLength(1)
  imageUrl!: string;

  @IsOptional()
  @IsString()
  description?: string;
}
