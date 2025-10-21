import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested
} from "class-validator";
import { ExpenseStatus } from "@prisma/client";
import { CreateExpenseItemDto } from "./create-expense-item.dto";

export class UpdateExpenseDto {
  @IsOptional()
  @IsEnum(ExpenseStatus)
  status?: ExpenseStatus;

  @IsNumber({ maxDecimalPlaces: 2 })
  totalAmount!: number;

  @IsDateString()
  usageDate!: string;

  @IsString()
  @MaxLength(100)
  vendor!: string;

  @IsString()
  @MaxLength(500)
  purposeDetail!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateExpenseItemDto)
  items!: CreateExpenseItemDto[];

  @IsOptional()
  @IsString()
  siteId?: string;
}
