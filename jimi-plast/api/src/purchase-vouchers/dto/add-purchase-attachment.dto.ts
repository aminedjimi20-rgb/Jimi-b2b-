import { IsString, MinLength } from 'class-validator';

export class AddPurchaseAttachmentDto {
  @IsString()
  @MinLength(1)
  url!: string;
}
