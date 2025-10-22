import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
  UseInterceptors,
  UploadedFiles
} from "@nestjs/common";
import { FilesInterceptor } from "@nestjs/platform-express";
import { createReadStream } from "fs";
import type { Express, Response } from "express";
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

  @Get("meta")
  @Roles("submitter", "site_manager", "hq_admin", "auditor")
  metadata(@CurrentUser() user: AuthenticatedUser) {
    return this.expensesService.getMetadata(user);
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

  @Get("export")
  @Roles("submitter", "site_manager", "hq_admin", "auditor")
  async export(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListExpenseDto,
    @Res() res: Response
  ) {
    const { buffer, filename } = await this.expensesService.exportExpenses(user, query);
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(filename)}"`);
    res.send(buffer);
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

  @Get(":id")
  @Roles("submitter", "site_manager", "hq_admin", "auditor")
  detail(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.expensesService.findOne(user, id);
  }

  @Post(":id/attachments")
  @Roles("submitter", "site_manager", "hq_admin")
  @UseInterceptors(
    FilesInterceptor("files", 5, {
      limits: { fileSize: 10 * 1024 * 1024 }
    })
  )
  uploadAttachments(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @UploadedFiles() files: Express.Multer.File[]
  ) {
    return this.expensesService.addAttachments(user, id, files ?? []);
  }

  @Delete(":id/attachments/:attachmentId")
  @Roles("submitter", "site_manager", "hq_admin")
  deleteAttachment(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Param("attachmentId") attachmentId: string
  ) {
    return this.expensesService.deleteAttachment(user, id, attachmentId);
  }

  @Get(":id/attachments/:attachmentId")
  @Roles("submitter", "site_manager", "hq_admin", "auditor")
  async downloadAttachment(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Param("attachmentId") attachmentId: string,
    @Res() res: Response
  ) {
    const { metadata, path } = await this.expensesService.getAttachmentForDownload(user, id, attachmentId);
    res.setHeader("Content-Type", metadata.mimeType || "application/octet-stream");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${encodeURIComponent(metadata.originalName)}"`
    );
    res.setHeader("Content-Length", metadata.size.toString());
    const stream = createReadStream(path);
    stream.on("error", () => {
      res.status(500).end();
    });
    stream.pipe(res);
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
