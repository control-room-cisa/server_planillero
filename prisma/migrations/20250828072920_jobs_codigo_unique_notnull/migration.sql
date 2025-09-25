/*
  Warnings:

  - A unique constraint covering the columns `[codigo]` on the table `jobs` will be added. If there are existing duplicate values, this will fail.
  - Made the column `codigo` on table `jobs` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE `jobs` MODIFY `codigo` VARCHAR(10) NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX `jobs_codigo_key` ON `jobs`(`codigo`);
