import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { ExpensesService } from "./expenses.service";
import { ExpensesController } from "./expenses.controller";

@Module({
  imports: [AuthModule],
  controllers: [ExpensesController],
  providers: [ExpensesService]
})
export class ExpensesModule {}
