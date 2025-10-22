import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { Express } from "express";
import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import ExcelJS from "exceljs";
import {
  ApprovalAction,
  ExpenseStatus,
  Prisma,
  ExpenseAttachment as ExpenseAttachmentModel,
  UserStatus
} from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AuthenticatedUser } from "../auth/auth.types";
import { CreateExpenseDto } from "./dto/create-expense.dto";
import { ListExpenseDto } from "./dto/list-expense.dto";
import { ApproveExpenseDto } from "./dto/approve-expense.dto";
import { RejectExpenseDto } from "./dto/reject-expense.dto";
import { EXPENSE_CATEGORIES } from "./expenses.constants";
import { UpdateExpenseDto } from "./dto/update-expense.dto";

const expenseDetailInclude = {
  site: {
    select: { id: true, code: true, name: true }
  },
  user: {
    select: { id: true, fullName: true, email: true }
  },
  items: {
    orderBy: { usageDate: "asc" }
  },
  approvals: {
    orderBy: { actedAt: "asc" },
    select: {
      id: true,
      step: true,
      action: true,
      comment: true,
      actedAt: true,
      approver: {
        select: { id: true, fullName: true, email: true }
      }
    }
  },
  attachments: {
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      originalName: true,
      mimeType: true,
      size: true,
      createdAt: true,
      filePath: true
    }
  }
} satisfies Prisma.ExpenseInclude;

type ExpenseWithRelations = Prisma.ExpenseGetPayload<{ include: typeof expenseDetailInclude }>;

const ATTACHMENTS_ROOT =
  process.env.EXPENSE_ATTACHMENTS_DIR ?? path.resolve(process.cwd(), "uploads", "expenses");
const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_ATTACHMENTS_PER_REQUEST = 5;

const MIME_FALLBACK = "application/octet-stream";

async function ensureDirectory(dirPath: string) {
  await fs.mkdir(dirPath, { recursive: true });
}

function sanitizeFilename(originalName: string) {
  const base = originalName.replace(/[/\\?%*:|"<>]/g, "_");
  return base || "attachment";
}

@Injectable()
export class ExpensesService {
  constructor(private readonly prisma: PrismaService) {}

  private get attachmentsRoot() {
    return ATTACHMENTS_ROOT;
  }

  private readonly editableStatuses: ExpenseStatus[] = [
    ExpenseStatus.DRAFT,
    ExpenseStatus.PENDING_SITE,
    ExpenseStatus.PENDING_HQ,
    ExpenseStatus.REJECTED_SITE,
    ExpenseStatus.REJECTED_HQ
  ];

  private readonly resubmittableStatuses: ExpenseStatus[] = [
    ExpenseStatus.DRAFT,
    ExpenseStatus.REJECTED_SITE,
    ExpenseStatus.REJECTED_HQ
  ];

  async create(user: AuthenticatedUser, dto: CreateExpenseDto) {
    const targetSiteId = dto.siteId ?? user.siteId;

    if (!targetSiteId) {
      throw new Error("현장 정보가 필요합니다.");
    }

    const status = dto.status ?? ExpenseStatus.PENDING_SITE;

    const expense = await this.prisma.expense.create({
      data: {
        userId: user.id,
        siteId: targetSiteId,
        status,
        totalAmount: new Prisma.Decimal(dto.totalAmount),
        usageDate: new Date(dto.usageDate),
        vendor: dto.vendor,
        purposeDetail: dto.purposeDetail,
        items: {
          createMany: {
            data: dto.items.map((item) => ({
              category: item.category,
              paymentMethod: item.paymentMethod,
              amount: new Prisma.Decimal(item.amount),
              usageDate: new Date(item.usageDate),
              vendor: item.vendor,
              description: item.description ?? null
            }))
          }
        }
      },
      include: {
        items: true,
        site: true
      }
    });

    return expense;
  }

  async findAll(user: AuthenticatedUser, query: ListExpenseDto) {
    const filters = this.buildFilters(user, query);

    const expenses = await this.prisma.expense.findMany({
      where: filters,
      include: {
        site: true,
        user: {
          select: {
            id: true,
            fullName: true,
            email: true
          }
        },
        items: true,
        approvals: {
          select: {
            id: true,
            step: true,
            action: true,
            comment: true,
            actedAt: true
          }
        }
      },
      orderBy: {
        updatedAt: "desc"
      }
    });

    return expenses.map((expense) => {
      const isOwner = expense.userId === user.id;
      const canEdit =
        isOwner &&
        ((user.role === "submitter" && this.editableStatuses.includes(expense.status)) ||
          ((user.role === "site_manager" || user.role === "hq_admin") &&
            this.editableStatuses.includes(expense.status)));
      const canResubmit =
        user.role === "submitter" && isOwner && this.resubmittableStatuses.includes(expense.status);

      return {
        ...expense,
        permissions: {
          canEdit,
          canResubmit
        }
      };
    });
  }

  async getDashboardSummary(user: AuthenticatedUser) {
    const baseWhere: Prisma.ExpenseWhereInput = {};
    if (user.role === "submitter") {
      baseWhere.userId = user.id;
    } else if (user.role === "site_manager") {
      baseWhere.siteId = user.siteId ?? undefined;
    }

    const [pendingSite, pendingHq, approved, recent] = await Promise.all([
      this.prisma.expense.count({
        where: { ...baseWhere, status: ExpenseStatus.PENDING_SITE }
      }),
      this.prisma.expense.count({
        where: { ...baseWhere, status: ExpenseStatus.PENDING_HQ }
      }),
      this.prisma.expense.count({
        where: { ...baseWhere, status: ExpenseStatus.APPROVED }
      }),
      this.prisma.expense.findMany({
        where: baseWhere,
        orderBy: { updatedAt: "desc" },
        take: 10,
        select: {
          id: true,
          status: true,
          totalAmount: true,
          usageDate: true,
          updatedAt: true,
          vendor: true,
          purposeDetail: true,
          siteId: true,
          userId: true,
          site: {
            select: { id: true, name: true, code: true }
          },
          user: {
            select: { id: true, fullName: true, email: true }
          },
          items: {
            select: {
              category: true,
              paymentMethod: true,
              amount: true,
              usageDate: true,
              vendor: true,
              description: true
            }
          },
          approvals: {
            select: {
              step: true,
              comment: true
            }
          }
        }
      })
    ]);

    const approvalRate = await this.calculateApprovalRate(baseWhere);

    return {
      metrics: {
        approvalRate,
        pendingSite,
        pendingHq,
        approved
      },
      recent: recent.map((item) => ({
        id: item.id,
        status: item.status,
        totalAmount: item.totalAmount.toString(),
        usageDate: item.usageDate.toISOString(),
        updatedAt: item.updatedAt.toISOString(),
        vendor: item.vendor,
        purposeDetail: item.purposeDetail,
        siteId: item.siteId,
        userId: item.userId,
        site: item.site
          ? {
              id: item.site.id,
              name: item.site.name,
              code: item.site.code
            }
          : null,
        user: item.user
          ? {
              id: item.user.id,
              fullName: item.user.fullName,
              email: item.user.email
            }
          : null,
        items: item.items.map((expenseItem) => ({
          category: expenseItem.category,
          paymentMethod: expenseItem.paymentMethod,
          amount: expenseItem.amount.toString(),
          usageDate: expenseItem.usageDate.toISOString(),
          vendor: expenseItem.vendor,
          description: expenseItem.description
        })),
        approvals: item.approvals.map((approval) => ({
          step: approval.step,
          comment: approval.comment
        }))
      }))
    };
  }

  private async calculateApprovalRate(where: Prisma.ExpenseWhereInput) {
    const totalCount = await this.prisma.expense.count({ where });
    if (totalCount === 0) {
      return 0;
    }
    const approvedCount = await this.prisma.expense.count({
      where: { ...where, status: ExpenseStatus.APPROVED }
    });
    return Math.round((approvedCount / totalCount) * 100);
  }

  async getPendingApprovals(user: AuthenticatedUser) {
    const where: Prisma.ExpenseWhereInput = {};
    if (user.role === "site_manager") {
      where.status = ExpenseStatus.PENDING_SITE;
      where.siteId = user.siteId ?? undefined;
    } else if (user.role === "hq_admin") {
      where.status = ExpenseStatus.PENDING_HQ;
    } else {
      return [];
    }

    return this.prisma.expense.findMany({
      where,
      include: {
        user: {
          select: { fullName: true, email: true }
        },
        site: {
          select: { name: true, code: true }
        },
        items: {
          select: { category: true, amount: true, paymentMethod: true, description: true }
        },
        approvals: {
          select: {
            id: true,
            step: true,
            comment: true
          }
        }
      },
      orderBy: {
        updatedAt: "desc"
      }
    });
  }

  async approveExpenses(user: AuthenticatedUser, dto: ApproveExpenseDto) {
    return this.handleApprovalAction(user, dto.expenseIds, {
      type: "approve",
      comment: dto.comment
    });
  }

  async rejectExpenses(user: AuthenticatedUser, dto: RejectExpenseDto) {
    return this.handleApprovalAction(user, dto.expenseIds, {
      type: "reject",
      comment: dto.comment
    });
  }

  private async handleApprovalAction(
    user: AuthenticatedUser,
    expenseIds: string[],
    options: { type: "approve" | "reject"; comment?: string }
  ) {
    if (expenseIds.length === 0) {
      return { count: 0 };
    }

    const expenses = await this.prisma.expense.findMany({
      where: {
        id: { in: expenseIds }
      },
      select: {
        id: true,
        status: true,
        siteId: true,
        userId: true
      }
    });

    if (expenses.length !== expenseIds.length) {
      const missingIds = expenseIds.filter((id) => !expenses.some((expense) => expense.id === id));
      throw new Error(`존재하지 않는 경비 ID: ${missingIds.join(", ")}`);
    }

    const now = new Date();

    const transactions = expenses.map((expense) => {
      const { nextStatus, step, action, comment } = this.calculateNextStatus({
        expense,
        user,
        type: options.type,
        comment: options.comment
      });

      return this.prisma.expense.update({
        where: { id: expense.id },
        data: {
          status: nextStatus,
          approvals: {
            create: {
              step,
              approverId: user.id,
              action,
              comment,
              actedAt: now
            }
          }
        }
      });
    });

    const updated = await this.prisma.$transaction(transactions);

    return {
      count: updated.length,
      items: updated.map((item) => ({
        id: item.id,
        status: item.status
      }))
    };
  }

  private calculateNextStatus({
    expense,
    user,
    type,
    comment
  }: {
    expense: { id: string; status: ExpenseStatus; siteId: string; userId: string };
    user: AuthenticatedUser;
    type: "approve" | "reject";
    comment?: string;
  }) {
    const trimmedComment = comment?.trim();

    if (user.role === "site_manager") {
      if (!user.siteId || user.siteId !== expense.siteId) {
        throw new Error("해당 현장에 대한 권한이 없습니다.");
      }
      if (expense.status !== ExpenseStatus.PENDING_SITE) {
        throw new Error("소장 승인 단계의 경비만 처리할 수 있습니다.");
      }

      if (type === "approve") {
        return {
          nextStatus: ExpenseStatus.PENDING_HQ,
          step: 1,
          action: ApprovalAction.APPROVED,
          comment: trimmedComment ?? null
        };
      }

      if (!trimmedComment) {
        throw new Error("반려 사유를 입력해 주세요.");
      }

      return {
        nextStatus: ExpenseStatus.REJECTED_SITE,
        step: 1,
        action: ApprovalAction.REJECTED,
        comment: trimmedComment
      };
    }

    if (user.role === "hq_admin") {
      if (expense.status !== ExpenseStatus.PENDING_HQ) {
        throw new Error("본사 승인 단계의 경비만 처리할 수 있습니다.");
      }

      if (type === "approve") {
        return {
          nextStatus: ExpenseStatus.APPROVED,
          step: 2,
          action: ApprovalAction.APPROVED,
          comment: trimmedComment ?? null
        };
      }

      if (!trimmedComment) {
        throw new Error("반려 사유를 입력해 주세요.");
      }

      return {
        nextStatus: ExpenseStatus.REJECTED_HQ,
        step: 2,
        action: ApprovalAction.REJECTED,
        comment: trimmedComment
      };
    }

    throw new Error("승인 권한이 없는 역할입니다.");
  }

  async getMetadata(user: AuthenticatedUser) {
    const categories = EXPENSE_CATEGORIES;
    let sites: Array<{ id: string; code: string; name: string }> = [];

    if (user.role === "hq_admin") {
      sites = await this.prisma.site.findMany({
        where: { isActive: true },
        select: { id: true, code: true, name: true },
        orderBy: { name: "asc" }
      });
    } else if (user.siteId) {
      const site = await this.prisma.site.findUnique({
        where: { id: user.siteId },
        select: { id: true, code: true, name: true }
      });
      sites = site ? [site] : [];
    }

    let users: Array<{ id: string; fullName: string; email: string; siteId: string | null }> = [];

    if (user.role === "hq_admin" || user.role === "auditor") {
      users = await this.prisma.user.findMany({
        where: { status: UserStatus.ACTIVE },
        select: { id: true, fullName: true, email: true, siteId: true },
        orderBy: { fullName: "asc" }
      });
    } else if (user.role === "site_manager" && user.siteId) {
      users = await this.prisma.user.findMany({
        where: { status: UserStatus.ACTIVE, siteId: user.siteId },
        select: { id: true, fullName: true, email: true, siteId: true },
        orderBy: { fullName: "asc" }
      });
    } else {
      const self = await this.prisma.user.findUnique({
        where: { id: user.id },
        select: { id: true, fullName: true, email: true, siteId: true }
      });
      users = self ? [self] : [];
    }

    return {
      categories,
      sites,
      users
    };
  }

  async findOne(user: AuthenticatedUser, expenseId: string) {
    const expense = await this.prisma.expense.findUnique({
      where: { id: expenseId },
      include: expenseDetailInclude
    });

    if (!expense) {
      throw new NotFoundException("경비를 찾을 수 없습니다.");
    }

    this.ensureReadable(user, expense);

    return this.toExpenseResponse(expense, user);
  }

  async updateExpense(user: AuthenticatedUser, expenseId: string, dto: UpdateExpenseDto) {
    const expense = await this.prisma.expense.findUnique({
      where: { id: expenseId },
      include: { site: true, user: true, approvals: true }
    });

    if (!expense) {
      throw new NotFoundException("경비를 찾을 수 없습니다.");
    }

    this.ensureEditable(user, expense);

    const targetSiteId = dto.siteId ?? expense.siteId;

    if (!targetSiteId) {
      throw new BadRequestException("현장 정보를 선택해 주세요.");
    }

    const nextStatus = dto.status ?? expense.status;
    if (user.role === "submitter") {
      const allowedStatuses = new Set<ExpenseStatus>([...this.editableStatuses, ExpenseStatus.PENDING_SITE]);
      if (!allowedStatuses.has(nextStatus)) {
        throw new BadRequestException("허용되지 않은 상태로 변경할 수 없습니다.");
      }
    }

    const updated = await this.prisma.expense.update({
      where: { id: expenseId },
      data: {
        siteId: targetSiteId,
        status: nextStatus,
        totalAmount: new Prisma.Decimal(dto.totalAmount),
        usageDate: new Date(dto.usageDate),
        vendor: dto.vendor,
        purposeDetail: dto.purposeDetail,
        items: {
          deleteMany: {},
          createMany: {
            data: dto.items.map((item) => ({
              category: item.category,
              paymentMethod: item.paymentMethod,
              amount: new Prisma.Decimal(item.amount),
              usageDate: new Date(item.usageDate),
              vendor: item.vendor,
              description: item.description ?? null
            }))
          }
        }
      },
      include: expenseDetailInclude
    });

    return this.toExpenseResponse(updated, user);
  }

  async exportExpenses(user: AuthenticatedUser, query: ListExpenseDto) {
    const filters = this.buildFilters(user, query);
    const expenses = await this.prisma.expense.findMany({
      where: filters,
      include: {
        site: {
          select: { name: true, code: true }
        },
        user: {
          select: { fullName: true, email: true }
        },
        items: {
          select: { category: true, amount: true }
        },
        approvals: {
          orderBy: { actedAt: "asc" },
          select: {
            step: true,
            action: true,
            actedAt: true,
            approver: {
              select: { fullName: true, email: true }
            }
          }
        }
      },
      orderBy: {
        updatedAt: "desc"
      }
    });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Expenses");

    worksheet.columns = [
      { header: "경비 ID", key: "id", width: 36 },
      { header: "상태", key: "status", width: 18 },
      { header: "현장", key: "site", width: 24 },
      { header: "제출자", key: "submitter", width: 24 },
      { header: "총 금액", key: "amount", width: 16 },
      { header: "사용일", key: "usageDate", width: 16 },
      { header: "업데이트", key: "updatedAt", width: 20 },
      { header: "항목 요약", key: "items", width: 42 },
      { header: "승인 이력", key: "approvals", width: 42 }
    ];

    for (const expense of expenses) {
      const itemsSummary = expense.items
        .map((item) => `${item.category}: ${Number(item.amount)}`)
        .join("\n");
      const approvalsSummary = expense.approvals
        .map((approval) => {
          const approver = approval.approver?.fullName ?? approval.approver?.email ?? "-";
          const acted = approval.actedAt ? approval.actedAt.toISOString().split("T")[0] : "대기";
          return `Step ${approval.step} ${approval.action} · ${approver} (${acted})`;
        })
        .join("\n");

      worksheet.addRow({
        id: expense.id,
        status: expense.status,
        site: expense.site?.name ?? expense.site?.code ?? "-",
        submitter: expense.user?.fullName ?? expense.user?.email ?? "-",
        amount: Number(expense.totalAmount),
        usageDate: expense.usageDate.toISOString().split("T")[0],
        updatedAt: expense.updatedAt.toISOString().split("T")[0],
        items: itemsSummary,
        approvals: approvalsSummary
      });
    }

    worksheet.getRow(1).font = { bold: true };
    worksheet.getColumn(5).numFmt = "#,##0";

    const arrayBuffer = await workbook.xlsx.writeBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const timestamp = new Date();
    const filename = `expenses_${timestamp.toISOString().replace(/[-:]/g, "").slice(0, 15)}.xlsx`;

    return { buffer, filename };
  }

  async addAttachments(user: AuthenticatedUser, expenseId: string, files: Express.Multer.File[]) {
    if (!files || files.length === 0) {
      return [];
    }
    if (files.length > MAX_ATTACHMENTS_PER_REQUEST) {
      throw new BadRequestException(`한 번에 최대 ${MAX_ATTACHMENTS_PER_REQUEST}개 파일까지 업로드할 수 있습니다.`);
    }

    const expense = await this.prisma.expense.findUnique({
      where: { id: expenseId },
      select: { id: true, userId: true, siteId: true }
    });

    if (!expense) {
      throw new NotFoundException("경비를 찾을 수 없습니다.");
    }

    this.ensureAttachmentWriteAccess(user, expense);

    await ensureDirectory(this.attachmentsRoot);
    const expenseDir = path.join(this.attachmentsRoot, expenseId);
    await ensureDirectory(expenseDir);

    const created: ExpenseAttachmentModel[] = [];

    for (const file of files) {
      if (file.size > MAX_ATTACHMENT_SIZE) {
        throw new BadRequestException(
          `파일 '${file.originalname}'의 크기가 제한(10MB)을 초과했습니다.`
        );
      }
      const safeName = sanitizeFilename(file.originalname);
      const uniqueName = `${randomUUID()}-${safeName}`;
      const relativePath = path.posix.join(expenseId, uniqueName);
      const absolutePath = this.resolveAttachmentPath(relativePath);

      await ensureDirectory(path.dirname(absolutePath));
      if (!file.buffer) {
        throw new BadRequestException("업로드된 파일 데이터를 읽을 수 없습니다.");
      }
      await fs.writeFile(absolutePath, file.buffer);

      const attachment = await this.prisma.expenseAttachment.create({
        data: {
          expenseId,
          filePath: relativePath,
          originalName: file.originalname,
          mimeType: file.mimetype || MIME_FALLBACK,
          size: file.size
        }
      });
      created.push(attachment);
    }

    return created.map((attachment) => this.toAttachmentResponse(attachment));
  }

  async deleteAttachment(user: AuthenticatedUser, expenseId: string, attachmentId: string) {
    const attachment = await this.prisma.expenseAttachment.findUnique({
      where: { id: attachmentId },
      include: {
        expense: {
          select: {
            id: true,
            userId: true,
            siteId: true
          }
        }
      }
    });

    if (!attachment || attachment.expenseId !== expenseId) {
      throw new NotFoundException("첨부 파일을 찾을 수 없습니다.");
    }

    this.ensureAttachmentWriteAccess(user, attachment.expense);

    await this.prisma.expenseAttachment.delete({
      where: { id: attachmentId }
    });

    const absolutePath = this.resolveAttachmentPath(attachment.filePath);
    await fs.unlink(absolutePath).catch(() => undefined);

    return this.toAttachmentResponse(attachment);
  }

  async getAttachmentForDownload(user: AuthenticatedUser, expenseId: string, attachmentId: string) {
    const attachment = await this.prisma.expenseAttachment.findUnique({
      where: { id: attachmentId },
      include: {
        expense: {
          select: {
            id: true,
            userId: true,
            siteId: true
          }
        }
      }
    });

    if (!attachment || attachment.expenseId !== expenseId) {
      throw new NotFoundException("첨부 파일을 찾을 수 없습니다.");
    }

    this.ensureReadable(user, {
      userId: attachment.expense.userId,
      siteId: attachment.expense.siteId
    });

    const absolutePath = this.resolveAttachmentPath(attachment.filePath);
    try {
      await fs.access(absolutePath);
    } catch {
      throw new NotFoundException("첨부 파일을 찾을 수 없습니다.");
    }

    return {
      metadata: this.toAttachmentResponse(attachment),
      path: absolutePath
    };
  }

  private buildFilters(user: AuthenticatedUser, query: ListExpenseDto): Prisma.ExpenseWhereInput {
    const filters: Prisma.ExpenseWhereInput = {};

    if (user.role === "submitter") {
      filters.userId = user.id;
    } else if (user.role === "site_manager") {
      filters.siteId = user.siteId ?? undefined;
    } else if (user.role !== "hq_admin") {
      filters.siteId = user.siteId ?? undefined;
    }

    if (query.siteId) {
      filters.siteId = query.siteId;
    }

    if (query.status && query.status.length > 0) {
      filters.status = {
        in: query.status
      };
    }

    if (query.dateFrom || query.dateTo) {
      filters.usageDate = {};
      if (query.dateFrom) {
        filters.usageDate.gte = new Date(query.dateFrom);
      }
      if (query.dateTo) {
        const end = new Date(query.dateTo);
        end.setHours(23, 59, 59, 999);
        filters.usageDate.lte = end;
      }
    }

    if (query.amountMin !== undefined || query.amountMax !== undefined) {
      filters.totalAmount = {};
      if (query.amountMin !== undefined) {
        filters.totalAmount.gte = new Prisma.Decimal(query.amountMin);
      }
      if (query.amountMax !== undefined) {
        filters.totalAmount.lte = new Prisma.Decimal(query.amountMax);
      }
    }

    if (query.category) {
      filters.items = {
        some: {
          category: query.category
        }
      };
    }

    if (query.userId) {
      const allowedToOverride =
        user.role === "hq_admin" ||
        user.role === "auditor" ||
        (user.role === "site_manager" && !!user.siteId) ||
        user.id === query.userId;
      if (allowedToOverride) {
        filters.userId = query.userId;
      }
    }

    if (query.keyword) {
      const trimmed = query.keyword.trim();
      if (trimmed.length > 0) {
        const caseInsensitiveContains = { contains: trimmed, mode: "insensitive" as const };
        const existingAnd = Array.isArray(filters.AND) ? filters.AND : filters.AND ? [filters.AND] : [];
        filters.AND = [
          ...existingAnd,
          {
            OR: [
              { vendor: caseInsensitiveContains },
              { purposeDetail: caseInsensitiveContains },
              {
                user: {
                  is: {
                    OR: [
                      { fullName: caseInsensitiveContains },
                      { email: caseInsensitiveContains }
                    ]
                  }
                }
              },
              {
                site: {
                  is: {
                    OR: [
                      { name: caseInsensitiveContains },
                      { code: caseInsensitiveContains }
                    ]
                  }
                }
              },
              { items: { some: { description: caseInsensitiveContains } } },
              { approvals: { some: { comment: caseInsensitiveContains } } }
            ]
          }
        ];
      }
    }

    return filters;
  }

  private resolveAttachmentPath(relativePath: string) {
    const normalized = path.normalize(relativePath);
    if (normalized.startsWith("..")) {
      throw new BadRequestException("잘못된 파일 경로입니다.");
    }
    return path.join(this.attachmentsRoot, normalized);
  }

  private ensureAttachmentWriteAccess(
    user: AuthenticatedUser,
    expense: { userId: string; siteId: string | null }
  ) {
    if (user.role === "hq_admin") {
      return;
    }
    if (user.role === "site_manager" && user.siteId && expense.siteId === user.siteId) {
      return;
    }
    if (user.role === "submitter" && expense.userId === user.id) {
      return;
    }
    throw new ForbiddenException("첨부 파일을 수정할 권한이 없습니다.");
  }

  private ensureReadable(user: AuthenticatedUser, expense: { userId: string; siteId: string | null }) {
    if (user.role === "submitter" && expense.userId !== user.id) {
      throw new ForbiddenException("경비에 접근할 수 없습니다.");
    }

    if (user.role === "site_manager" && user.siteId && expense.siteId !== user.siteId) {
      throw new ForbiddenException("경비에 접근할 수 없습니다.");
    }
  }

  private ensureEditable(user: AuthenticatedUser, expense: { userId: string; status: ExpenseStatus }) {
    const isOwner = expense.userId === user.id;

    if (user.role === "submitter") {
      if (!isOwner) {
        throw new ForbiddenException("경비를 수정할 권한이 없습니다.");
      }
      if (!this.editableStatuses.includes(expense.status)) {
        throw new BadRequestException("현재 상태에서는 경비를 수정할 수 없습니다.");
      }
      return;
    }

    if ((user.role === "site_manager" || user.role === "hq_admin") && isOwner) {
      if (!this.editableStatuses.includes(expense.status)) {
        throw new BadRequestException("현재 상태에서는 경비를 수정할 수 없습니다.");
      }
      return;
    }

    throw new ForbiddenException("경비를 수정할 권한이 없습니다.");
  }

  private toAttachmentResponse(attachment: {
    id: string;
    originalName: string;
    mimeType: string;
    size: number;
    createdAt: Date;
  }) {
    return {
      id: attachment.id,
      originalName: attachment.originalName,
      mimeType: attachment.mimeType,
      size: attachment.size,
      createdAt: attachment.createdAt.toISOString()
    };
  }

  private toExpenseResponse(expense: ExpenseWithRelations, user: AuthenticatedUser) {
    const isOwner = expense.userId === user.id;
    const canEdit = (() => {
      if (!isOwner) {
        return false;
      }
      if (user.role === "submitter") {
        return this.editableStatuses.includes(expense.status);
      }
      if (user.role === "site_manager" || user.role === "hq_admin") {
        return this.editableStatuses.includes(expense.status);
      }
      return false;
    })();

    const canResubmit =
      user.role === "submitter" && isOwner && this.resubmittableStatuses.includes(expense.status);

    return {
      id: expense.id,
      status: expense.status,
      totalAmount: expense.totalAmount.toString(),
      usageDate: expense.usageDate.toISOString(),
      vendor: expense.vendor,
      purposeDetail: expense.purposeDetail,
      site: expense.site,
      user: expense.user,
      createdAt: expense.createdAt.toISOString(),
      updatedAt: expense.updatedAt.toISOString(),
      items: expense.items.map((item) => ({
        id: item.id,
        category: item.category,
        paymentMethod: item.paymentMethod,
        amount: item.amount.toString(),
        usageDate: item.usageDate.toISOString(),
        vendor: item.vendor,
        description: item.description
      })),
      approvals: expense.approvals.map((approval) => ({
        id: approval.id,
        step: approval.step,
        action: approval.action,
        comment: approval.comment,
        actedAt: approval.actedAt ? approval.actedAt.toISOString() : null,
        approver: approval.approver
      })),
      attachments: expense.attachments.map((attachment) => this.toAttachmentResponse(attachment)),
      permissions: {
        canEdit,
        canResubmit
      }
    };
  }
}
