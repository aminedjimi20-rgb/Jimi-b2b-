import { IsInt, IsString, Min, MinLength } from 'class-validator';

export class AddPartnerLogoDto {
  @IsString()
  @MinLength(1)
  imageUrl!: string;
}

export class SetExperienceYearsDto {
  @IsInt()
  @Min(0)
  experienceYears!: number;
}
