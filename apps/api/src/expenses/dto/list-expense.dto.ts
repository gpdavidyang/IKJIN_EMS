import { Type } from "class-transformer";
import { IsDateString, IsEnum, IsNumber, IsOptional, IsString } from "class-validator";
import { ExpenseStatus } from "@prisma/client";

export class ListExpenseDto {
  @IsOptional()
  @IsEnum(ExpenseStatus, { each: true })
  status?: ExpenseStatus[];

  @IsOptional()
  @IsString()
  siteId?: string;

  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  amountMin?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  amountMax?: number;
}
