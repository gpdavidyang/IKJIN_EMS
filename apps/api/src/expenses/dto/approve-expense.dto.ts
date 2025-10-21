import { ArrayMinSize, IsArray, IsOptional, IsString, MaxLength } from "class-validator";

export class ApproveExpenseDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  expenseIds!: string[];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  comment?: string;
}
