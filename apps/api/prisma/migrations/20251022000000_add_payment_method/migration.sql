-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CORPORATE_CARD', 'PERSONAL_CARD', 'CASH', 'OTHER');

-- AlterTable
ALTER TABLE "ExpenseItem"
ADD COLUMN     "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'OTHER';
