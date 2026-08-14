import { IsIn, IsString } from 'class-validator';

export class RegisterDeviceTokenDto {
  @IsString()
  token!: string;

  @IsIn(['ANDROID', 'IOS', 'WEB'])
  platform!: 'ANDROID' | 'IOS' | 'WEB';
}
