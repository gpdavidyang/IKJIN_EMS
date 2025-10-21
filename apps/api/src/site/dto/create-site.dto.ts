import { IsBoolean, IsOptional, IsString, MaxLength } from "class-validator";

export class CreateSiteDto {
  @IsString()
  @MaxLength(20)
  code!: string;

  @IsString()
  @MaxLength(100)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  region?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
