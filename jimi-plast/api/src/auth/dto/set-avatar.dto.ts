import { IsString, MinLength } from 'class-validator';

export class SetAvatarDto {
  @IsString()
  @MinLength(1)
  avatarUrl!: string;
}
