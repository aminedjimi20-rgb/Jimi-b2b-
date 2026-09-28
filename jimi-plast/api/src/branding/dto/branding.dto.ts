import { IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';

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

export class SetCompanyInfoDto {
  @IsOptional()
  @IsString()
  companyLegalName?: string;

  @IsOptional()
  @IsString()
  companyAddress?: string;

  @IsOptional()
  @IsString()
  companyPhone?: string;

  @IsOptional()
  @IsString()
  companyRC?: string;

  @IsOptional()
  @IsString()
  companyNIF?: string;

  @IsOptional()
  @IsString()
  companyNIS?: string;

  @IsOptional()
  @IsString()
  companyAI?: string;
}
