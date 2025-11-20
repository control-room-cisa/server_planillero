/*
  Warnings:

  - A unique constraint covering the columns `[codigo_nomina]` on the table `nominas` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE `nominas` ADD COLUMN `codigo_nomina` VARCHAR(10) NULL,
    ADD COLUMN `pagado` BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX `nominas_codigo_nomina_key` ON `nominas`(`codigo_nomina`);
