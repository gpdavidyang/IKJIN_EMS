import { ArrayMinSize, IsArray, IsString, MaxLength } from "class-validator";

export class RejectExpenseDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  expenseIds!: string[];

  @IsString()
  @MaxLength(500)
  comment!: string;
}
