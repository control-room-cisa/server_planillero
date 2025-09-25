/*
  Warnings:

  - A unique constraint covering the columns `[fecha]` on the table `Feriado` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE `feriado` MODIFY `fecha` VARCHAR(10) NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX `Feriado_fecha_key` ON `Feriado`(`fecha`);
