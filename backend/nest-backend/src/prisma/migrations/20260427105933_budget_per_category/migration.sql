/*
  Warnings:

  - Added the required column `updatedAt` to the `Budget` table without a default value. This is not possible if the table is not empty.
  - Made the column `category` on table `Budget` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Budget" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "category" SET NOT NULL;
