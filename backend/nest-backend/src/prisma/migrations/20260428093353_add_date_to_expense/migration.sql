/*
  Warnings:

  - You are about to drop the column `date` on the `ExpenseSplit` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Expense" ADD COLUMN     "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "ExpenseSplit" DROP COLUMN "date";
