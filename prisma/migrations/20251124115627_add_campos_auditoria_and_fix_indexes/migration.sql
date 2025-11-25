/*
  Warnings:

  - You are about to drop the column `codigo_empleado_creacion` on the `nominas` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[empleado_id,fecha_inicio,fecha_fin,deleted_at]` on the table `nominas` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX `nominas_codigo_nomina_key` ON `nominas`;

-- DropIndex
DROP INDEX `nominas_empleado_id_fecha_inicio_fecha_fin_key` ON `nominas`;

-- AlterTable
ALTER TABLE `nominas` DROP COLUMN `codigo_empleado_creacion`,
    ADD COLUMN `created_by` INTEGER NULL,
    ADD COLUMN `deleted_by` INTEGER NULL,
    ADD COLUMN `updated_by` INTEGER NULL;

-- CreateIndex
CREATE UNIQUE INDEX `nominas_empleado_id_fecha_inicio_fecha_fin_deleted_at_key` ON `nominas`(`empleado_id`, `fecha_inicio`, `fecha_fin`, `deleted_at`);

-- AddForeignKey
ALTER TABLE `nominas` ADD CONSTRAINT `nominas_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `empleados`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `nominas` ADD CONSTRAINT `nominas_updated_by_fkey` FOREIGN KEY (`updated_by`) REFERENCES `empleados`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `nominas` ADD CONSTRAINT `nominas_deleted_by_fkey` FOREIGN KEY (`deleted_by`) REFERENCES `empleados`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
