import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import { AuthenticatedUser } from "../auth/auth.types";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { ExpensesService } from "./expenses.service";
import { CreateExpenseDto } from "./dto/create-expense.dto";
import { ListExpenseDto } from "./dto/list-expense.dto";
import { ApproveExpenseDto } from "./dto/approve-expense.dto";
import { RejectExpenseDto } from "./dto/reject-expense.dto";
import { UpdateExpenseDto } from "./dto/update-expense.dto";

@Controller("expenses")
@UseGuards(JwtAuthGuard, RolesGuard)
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  @Post()
  @Roles("submitter", "site_manager", "hq_admin")
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateExpenseDto) {
    return this.expensesService.create(user, dto);
  }

  @Get()
  @Roles("submitter", "site_manager", "hq_admin", "auditor")
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: ListExpenseDto) {
    return this.expensesService.findAll(user, query);
  }

  @Get(":id")
  @Roles("submitter", "site_manager", "hq_admin", "auditor")
  detail(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.expensesService.findOne(user, id);
  }

  @Get("dashboard")
  @Roles("submitter", "site_manager", "hq_admin", "auditor")
  dashboard(@CurrentUser() user: AuthenticatedUser) {
    return this.expensesService.getDashboardSummary(user);
  }

  @Get("pending")
  @Roles("site_manager", "hq_admin")
  pending(@CurrentUser() user: AuthenticatedUser) {
    return this.expensesService.getPendingApprovals(user);
  }

  @Post("approve")
  @Roles("site_manager", "hq_admin")
  approve(@CurrentUser() user: AuthenticatedUser, @Body() dto: ApproveExpenseDto) {
    return this.expensesService.approveExpenses(user, dto);
  }

  @Post("reject")
  @Roles("site_manager", "hq_admin")
  reject(@CurrentUser() user: AuthenticatedUser, @Body() dto: RejectExpenseDto) {
    return this.expensesService.rejectExpenses(user, dto);
  }

  @Get("meta")
  @Roles("submitter", "site_manager", "hq_admin", "auditor")
  metadata(@CurrentUser() user: AuthenticatedUser) {
    return this.expensesService.getMetadata(user);
  }

  @Patch(":id")
  @Roles("submitter")
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: UpdateExpenseDto
  ) {
    return this.expensesService.updateExpense(user, id, dto);
  }
}
