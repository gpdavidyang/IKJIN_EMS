import { IsDateString, IsEnum, IsNumber, IsOptional, IsString, MaxLength } from "class-validator";
import { PaymentMethod } from "@prisma/client";

export class CreateExpenseItemDto {
  @IsString()
  category!: string;

  @IsEnum(PaymentMethod)
  paymentMethod!: PaymentMethod;

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
