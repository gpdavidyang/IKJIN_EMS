import { IsString, MinLength, Matches } from "class-validator";

export class ChangePasswordDto {
  @IsString()
  @MinLength(6)
  currentPassword!: string;

  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[A-Za-z])(?=.*\d).+$/, {
    message: "새 비밀번호는 영문과 숫자를 각각 최소 1개 이상 포함해야 합니다."
  })
  newPassword!: string;
}
