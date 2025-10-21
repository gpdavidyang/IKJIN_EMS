import { IsEmail, IsEnum, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class CreateUserDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MaxLength(100)
  fullName!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsString()
  role!: string;

  @IsOptional()
  @IsString()
  siteId?: string;

  @IsOptional()
  @IsEnum(["ACTIVE", "INACTIVE"] as const)
  status?: "ACTIVE" | "INACTIVE";
}
