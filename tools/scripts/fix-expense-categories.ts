import { PaymentMethod, PrismaClient } from "@prisma/client";
import { EXPENSE_CATEGORIES } from "../../apps/api/src/expenses/expenses.constants";

const prisma = new PrismaClient();

const PAYMENT_METHOD_VALUES: Array<{ code: PaymentMethod; label: string }> = [
  { code: "CORPORATE_CARD", label: "법인카드" },
  { code: "PERSONAL_CARD", label: "개인카드" },
  { code: "CASH", label: "현금" },
  { code: "OTHER", label: "기타" }
];

async function ensureCategoryCodes() {
  const allowedCodes = new Set(EXPENSE_CATEGORIES.map((category) => category.code));

  const invalidItems = await prisma.expenseItem.findMany({
    where: {
      NOT: {
        category: {
          in: [...allowedCodes]
        }
      }
    },
    select: {
      id: true,
      category: true
    }
  });

  if (invalidItems.length === 0) {
    console.log("✅ 분류(계정) 코드가 올바르지 않은 항목은 없습니다.");
    return;
  }

  console.log(`⚠️  잘못된 분류(계정) 값을 가진 항목 ${invalidItems.length}건을 발견했습니다.`);
  for (const item of invalidItems.slice(0, 10)) {
    console.log(` - ExpenseItem ${item.id}: ${item.category}`);
  }
  if (invalidItems.length > 10) {
    console.log(`…외 ${invalidItems.length - 10}건`);
  }

  const result = await prisma.expenseItem.updateMany({
    where: {
      NOT: {
        category: {
          in: [...allowedCodes]
        }
      }
    },
    data: {
      category: "CAT999"
    }
  });

  console.log(`✅ 분류(계정) 코드가 목록에 없는 ${result.count}건을 'CAT999'(기타)로 갱신했습니다.`);
}

function buildPaymentLabel(label: string) {
  return `결제수단: ${label}`;
}

function appendPaymentLabel(base: string | null | undefined, methodLabel: string) {
  const text = base?.trim() ?? "";
  if (!text) {
    return methodLabel;
  }
  if (text.includes(methodLabel)) {
    return text;
  }
  return `${text} (${methodLabel})`.trim();
}

async function assignPaymentMethods() {
  const expenses = await prisma.expense.findMany({
    select: {
      id: true,
      purposeDetail: true,
      items: {
        select: { id: true, description: true }
      }
    },
    orderBy: { createdAt: "asc" }
  });

  if (expenses.length === 0) {
    console.log("⚠️ 업데이트할 경비 데이터가 없습니다.");
    return;
  }

  console.log(`결제 수단 힌트를 ${expenses.length}건의 경비에 순환 배정합니다.`);
  for (let index = 0; index < expenses.length; index += 1) {
    const expense = expenses[index];
    const { code, label } = PAYMENT_METHOD_VALUES[index % PAYMENT_METHOD_VALUES.length];
    const methodLabel = buildPaymentLabel(label);

    await prisma.expense.update({
      where: { id: expense.id },
      data: {
        purposeDetail: appendPaymentLabel(expense.purposeDetail, methodLabel)
      }
    });

    for (const item of expense.items) {
      await prisma.expenseItem.update({
        where: { id: item.id },
        data: {
          paymentMethod: code,
          description: appendPaymentLabel(item.description, methodLabel)
        }
      });
    }
  }

  console.log("✅ 모든 경비 항목에 결제 수단 텍스트를 할당했습니다.");
}

async function main() {
  await ensureCategoryCodes();
  await assignPaymentMethods();
}

main()
  .catch((error) => {
    console.error("🚨 데이터 정리 중 오류가 발생했습니다.", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
