import path from "path";
import { existsSync } from "fs";
import { config } from "dotenv";
import { PrismaClient, ExpenseStatus } from "@prisma/client";
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

  const site = await prisma.site.upsert({
    where: { code: "SITE001" },
    update: {},
    create: {
      code: "SITE001",
      name: "서울-한강재개발",
      region: "수도권"
    }
  });

  const passwordHash = await bcrypt.hash("P@ssw0rd!", 10);

  const hqRole = await prisma.role.findUniqueOrThrow({ where: { name: "hq_admin" } });
  const managerRole = await prisma.role.findUniqueOrThrow({ where: { name: "site_manager" } });
  const submitterRole = await prisma.role.findUniqueOrThrow({ where: { name: "submitter" } });

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

  const manager = await prisma.user.upsert({
    where: { email: "manager@ikjin.co.kr" },
    update: {},
    create: {
      email: "manager@ikjin.co.kr",
      fullName: "현장 소장",
      passwordHash,
      roleId: managerRole.id,
      siteId: site.id
    }
  });

  const submitter = await prisma.user.upsert({
    where: { email: "worker@ikjin.co.kr" },
    update: {},
    create: {
      email: "worker@ikjin.co.kr",
      fullName: "현장 직원",
      passwordHash,
      roleId: submitterRole.id,
      siteId: site.id
    }
  });

  const existingExpenses = await prisma.expense.count();
  if (existingExpenses === 0) {
    await prisma.expense.create({
      data: {
        userId: submitter.id,
        siteId: site.id,
        status: ExpenseStatus.PENDING_SITE,
        totalAmount: 120000,
        usageDate: new Date("2025-06-01"),
        vendor: "A식당",
        purposeDetail: "현장 야근 식대",
        items: {
          create: [
            {
              category: "CAT002",
              amount: 120000,
              usageDate: new Date("2025-06-01"),
              vendor: "A식당"
            }
          ]
        }
      }
    });

    await prisma.expense.create({
      data: {
        userId: submitter.id,
        siteId: site.id,
        status: ExpenseStatus.REJECTED_SITE,
        totalAmount: 80000,
        usageDate: new Date("2025-06-02"),
        vendor: "B자재상",
        purposeDetail: "자재 보충",
        items: {
          create: [
            {
              category: "CAT004",
              amount: 80000,
              usageDate: new Date("2025-06-02"),
              vendor: "B자재상",
              description: "PVC 자재"
            }
          ]
        }
      }
    });

    await prisma.expense.create({
      data: {
        userId: submitter.id,
        siteId: site.id,
        status: ExpenseStatus.PENDING_HQ,
        totalAmount: 45000,
        usageDate: new Date("2025-06-02"),
        vendor: "C편의점",
        purposeDetail: "현장 간식",
        items: {
          create: [
            {
              category: "CAT002",
              amount: 45000,
              usageDate: new Date("2025-06-02"),
              vendor: "C편의점"
            }
          ]
        }
      }
    });
  }

  console.log("Seed complete.");
  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  process.exitCode = 1;
});
