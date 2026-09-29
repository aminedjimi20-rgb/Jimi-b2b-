import { IsString } from 'class-validator';

export class FactoryResetDto {
  @IsString()
  confirm!: string;
}
