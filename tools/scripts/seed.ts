import path from "path";
import { existsSync, promises as fs } from "fs";
import { config } from "dotenv";
import { PrismaClient, ExpenseStatus, ApprovalAction, Prisma } from "@prisma/client";
import * as bcrypt from "bcrypt";

const envPathCandidates = [
  path.resolve(__dirname, "../../.env"),
  path.resolve(__dirname, "../../apps/api/.env")
];

const envPath = envPathCandidates.find((candidate) => existsSync(candidate));

if (envPath) {
  config({ path: envPath });
} else {
  config();
  console.warn("환경 변수 파일(.env)을 찾지 못했습니다. 시스템 환경 변수만 사용합니다.");
}

async function main() {
  const prisma = new PrismaClient();

  const safeDelete = async (callback: () => Promise<unknown>) => {
    try {
      await callback();
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2021") {
        return;
      }
      throw error;
    }
  };

  const roles = await prisma.role.createMany({
    data: [
      { name: "submitter" },
      { name: "site_manager" },
      { name: "hq_admin" },
      { name: "auditor" }
    ],
    skipDuplicates: true
  });

  console.log(`Roles upserted: ${roles.count}`);

  const sites = await Promise.all(
    [
      {
        code: "SITE001",
        name: "서울-한강재개발",
        region: "수도권",
        address: "서울특별시 영등포구 여의도동 123-4"
      },
      {
        code: "SITE002",
        name: "부산-항만보수",
        region: "영남권",
        address: "부산광역시 중구 중앙동 45-1"
      },
      {
        code: "SITE003",
        name: "대전-물류센터",
        region: "충청권",
        address: "대전광역시 유성구 대학로 77"
      }
    ].map((site) =>
      prisma.site.upsert({
        where: { code: site.code },
        update: { name: site.name, region: site.region, address: site.address },
        create: site
      })
    )
  );
  const siteByCode = new Map(sites.map((site) => [site.code, site]));

  const passwordHash = await bcrypt.hash("P@ssw0rd!", 10);

  const hqRole = await prisma.role.findUniqueOrThrow({ where: { name: "hq_admin" } });
  const managerRole = await prisma.role.findUniqueOrThrow({ where: { name: "site_manager" } });
  const submitterRole = await prisma.role.findUniqueOrThrow({ where: { name: "submitter" } });
  const auditorRole = await prisma.role.findUniqueOrThrow({ where: { name: "auditor" } });

  const admin = await prisma.user.upsert({
    where: { email: "admin@ikjin.co.kr" },
    update: {},
    create: {
      email: "admin@ikjin.co.kr",
      fullName: "본사 관리자",
      passwordHash,
      roleId: hqRole.id
    }
  });

  const managerInfos = [
    { email: "manager@ikjin.co.kr", fullName: "현장 소장", siteCode: "SITE001" },
    { email: "manager.busan@ikjin.co.kr", fullName: "부산 현장소장", siteCode: "SITE002" },
    { email: "manager.daejeon@ikjin.co.kr", fullName: "대전 현장소장", siteCode: "SITE003" }
  ];
  const managers = await Promise.all(
    managerInfos.map((managerInfo) =>
      prisma.user.upsert({
        where: { email: managerInfo.email },
        update: {
          fullName: managerInfo.fullName,
          siteId: siteByCode.get(managerInfo.siteCode)?.id
        },
        create: {
          email: managerInfo.email,
          fullName: managerInfo.fullName,
          passwordHash,
          roleId: managerRole.id,
          siteId: siteByCode.get(managerInfo.siteCode)?.id
        }
      })
    )
  );
  const managerBySite = new Map(
    managers.map((manager, index) => [managerInfos[index].siteCode, manager])
  );

  await Promise.all(
    managerInfos.map((managerInfo, index) =>
      prisma.site.update({
        where: { code: managerInfo.siteCode },
        data: { managerId: managers[index].id }
      })
    )
  );

  const submitterInfos = [
    { email: "worker@ikjin.co.kr", fullName: "현장 직원", siteCode: "SITE001" },
    { email: "worker2@ikjin.co.kr", fullName: "현장 직원 2", siteCode: "SITE001" },
    { email: "busan.worker@ikjin.co.kr", fullName: "부산 직원", siteCode: "SITE002" },
    { email: "daejeon.worker@ikjin.co.kr", fullName: "대전 직원", siteCode: "SITE003" }
  ];
  const submitters = await Promise.all(
    submitterInfos.map((workerInfo) =>
      prisma.user.upsert({
        where: { email: workerInfo.email },
        update: {
          fullName: workerInfo.fullName,
          siteId: siteByCode.get(workerInfo.siteCode)?.id
        },
        create: {
          email: workerInfo.email,
          fullName: workerInfo.fullName,
          passwordHash,
          roleId: submitterRole.id,
          siteId: siteByCode.get(workerInfo.siteCode)?.id
        }
      })
    )
  );
  const submittersBySite = new Map<string, typeof submitters>([
    [
      "SITE001",
      submitters.filter((_, index) => submitterInfos[index].siteCode === "SITE001")
    ],
    [
      "SITE002",
      submitters.filter((_, index) => submitterInfos[index].siteCode === "SITE002")
    ],
    [
      "SITE003",
      submitters.filter((_, index) => submitterInfos[index].siteCode === "SITE003")
    ]
  ]);

  await prisma.user.upsert({
    where: { email: "auditor@ikjin.co.kr" },
    update: {},
    create: {
      email: "auditor@ikjin.co.kr",
      fullName: "감사 담당자",
      passwordHash,
      roleId: auditorRole.id
    }
  });

  const existingExpenses = await prisma.expense.count();
  if (existingExpenses < 30) {
    await safeDelete(() => prisma.approval.deleteMany());
    await safeDelete(() => prisma.expenseItem.deleteMany());
    await safeDelete(() => prisma.expenseAttachment.deleteMany());
    await safeDelete(() => prisma.expense.deleteMany());

    const categories = ["CAT001", "CAT002", "CAT003", "CAT004", "CAT005", "CAT006", "CAT007", "CAT008"];
    const statusCycle = [
      ExpenseStatus.DRAFT,
      ExpenseStatus.PENDING_SITE,
      ExpenseStatus.REJECTED_SITE,
      ExpenseStatus.PENDING_HQ,
      ExpenseStatus.REJECTED_HQ,
      ExpenseStatus.APPROVED
    ];
    const baseDate = new Date("2025-06-01T00:00:00.000Z");

    const buildApprovals = (
      status: ExpenseStatus,
      siteCode: string,
      createdAt: Date
    ): Prisma.ApprovalCreateWithoutExpenseInput[] => {
      const manager = managerBySite.get(siteCode);
      const approvals: Prisma.ApprovalCreateWithoutExpenseInput[] = [];
      if (status === ExpenseStatus.PENDING_SITE) {
        approvals.push({
          step: 1,
          approverId: manager?.id ?? managers[0].id,
          action: ApprovalAction.PENDING
        });
      } else if (status === ExpenseStatus.REJECTED_SITE) {
        approvals.push({
          step: 1,
          approverId: manager?.id ?? managers[0].id,
          action: ApprovalAction.REJECTED,
          comment: "현장 기준 미충족",
          actedAt: new Date(createdAt.getTime() + 60 * 60 * 1000)
        });
      } else if (status === ExpenseStatus.PENDING_HQ) {
        approvals.push(
          {
            step: 1,
            approverId: manager?.id ?? managers[0].id,
            action: ApprovalAction.APPROVED,
            actedAt: new Date(createdAt.getTime() + 30 * 60 * 1000),
            comment: "현장 검토 완료"
          },
          {
            step: 2,
            approverId: admin.id,
            action: ApprovalAction.PENDING
          }
        );
      } else if (status === ExpenseStatus.REJECTED_HQ) {
        approvals.push(
          {
            step: 1,
            approverId: manager?.id ?? managers[0].id,
            action: ApprovalAction.APPROVED,
            actedAt: new Date(createdAt.getTime() + 30 * 60 * 1000),
            comment: "현장 검토 완료"
          },
          {
            step: 2,
            approverId: admin.id,
            action: ApprovalAction.REJECTED,
            actedAt: new Date(createdAt.getTime() + 2 * 60 * 60 * 1000),
            comment: "증빙 서류 부족"
          }
        );
      } else if (status === ExpenseStatus.APPROVED) {
        approvals.push(
          {
            step: 1,
            approverId: manager?.id ?? managers[0].id,
            action: ApprovalAction.APPROVED,
            actedAt: new Date(createdAt.getTime() + 30 * 60 * 1000),
            comment: "현장 검토 완료"
          },
          {
            step: 2,
            approverId: admin.id,
            action: ApprovalAction.APPROVED,
            actedAt: new Date(createdAt.getTime() + 2 * 60 * 60 * 1000),
            comment: "본사 검토 완료"
          }
        );
      }
      return approvals;
    };

    const createdExpenses: { id: string }[] = [];

    for (let i = 0; i < 30; i += 1) {
      const status = statusCycle[i % statusCycle.length];
      const site = sites[i % sites.length];
      const siteSubmitterPool = submittersBySite.get(site.code) ?? submitters;
      const submitter = siteSubmitterPool[i % siteSubmitterPool.length];
      const usageDate = new Date(baseDate.getTime() + i * 24 * 60 * 60 * 1000);
      const itemBaseAmount = 45000 + (i % 6) * 7500;
      const secondaryAmount = 18000 + ((i + 2) % 5) * 5200;
      const totalAmount = itemBaseAmount + secondaryAmount;
      const createdAt = new Date(usageDate.getTime() + 9 * 60 * 60 * 1000); // KST daytime

      const items = [
        {
          category: categories[i % categories.length],
          amount: itemBaseAmount,
          usageDate,
          vendor: `업체-${(i % 9) + 1}`,
          description: `지출 항목 ${i + 1}-1`
        },
        {
          category: categories[(i + 3) % categories.length],
          amount: secondaryAmount,
          usageDate: new Date(usageDate.getTime() + 12 * 60 * 60 * 1000),
          vendor: `업체-${((i + 2) % 9) + 1}`,
          description: `지출 항목 ${i + 1}-2`
        }
      ];

      const approvals = buildApprovals(status, site.code, createdAt);

      const data: Prisma.ExpenseCreateInput = {
        user: { connect: { id: submitter.id } },
        site: { connect: { id: site.id } },
        status,
        totalAmount,
        usageDate,
        vendor: `거래처 ${i + 1}`,
        purposeDetail: `현장 운영비 지출 #${i + 1}`,
        createdAt,
        updatedAt: new Date(createdAt.getTime() + 15 * 60 * 1000),
        items: {
          create: items
        },
        ...(approvals.length
          ? {
              approvals: {
                create: approvals
              }
            }
          : {})
      };

      const expense = await prisma.expense.create({ data });
      createdExpenses.push({ id: expense.id });
    }

    const attachmentsRootEnv = process.env.EXPENSE_ATTACHMENTS_DIR;
    const attachmentsRoot = attachmentsRootEnv ?? path.resolve(process.cwd(), "uploads", "expenses");
    if (!attachmentsRootEnv) {
      await fs.rm(attachmentsRoot, { recursive: true, force: true }).catch(() => undefined);
    }
    await fs.mkdir(attachmentsRoot, { recursive: true });

    const attachmentSamples = [
      { name: "receipt.txt", content: "샘플 영수증 데이터\n금액: 12,300원\n감사합니다." },
      { name: "invoice.txt", content: "거래명세서\n항목: 자재구매\n합계: 87,500원" },
      { name: "fuel.txt", content: "주유 영수증\n리터: 34L\n금액: 62,400원" }
    ];

    for (let i = 0; i < Math.min(9, createdExpenses.length); i += 1) {
      const expenseId = createdExpenses[i].id;
      const sample = attachmentSamples[i % attachmentSamples.length];
      const relativePath = path.posix.join(expenseId, sample.name);
      const absolutePath = path.join(attachmentsRoot, relativePath);
      await fs.mkdir(path.dirname(absolutePath), { recursive: true });
      const buffer = Buffer.from(sample.content, "utf8");
      await fs.writeFile(absolutePath, buffer);
      await prisma.expenseAttachment.create({
        data: {
          expenseId,
          filePath: relativePath,
          originalName: sample.name,
          mimeType: "text/plain",
          size: buffer.length
        }
      });
    }
  }

  console.log("Seed complete.");
  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  process.exitCode = 1;
});
