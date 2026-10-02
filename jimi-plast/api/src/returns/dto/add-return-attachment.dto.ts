import { IsString } from 'class-validator';

export class AddReturnAttachmentDto {
  @IsString()
  url!: string;
}
