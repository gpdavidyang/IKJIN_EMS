import { IsDateString, IsNumber, IsOptional, IsString, MaxLength } from "class-validator";

export class CreateExpenseItemDto {
  @IsString()
  category!: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  amount!: number;

  @IsDateString()
  usageDate!: string;

  @IsString()
  @MaxLength(100)
  vendor!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;
}
