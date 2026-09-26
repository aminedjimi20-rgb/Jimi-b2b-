import { IsString, MinLength } from 'class-validator';

export class AddVoucherAttachmentDto {
  @IsString()
  @MinLength(1)
  url!: string;
}
