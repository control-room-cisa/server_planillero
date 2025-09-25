/*
  Warnings:

  - Made the column `empresa_id` on table `jobs` required. This step will fail if there are existing NULL values in that column.
  - Made the column `mostrar_empresa_id` on table `jobs` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE `jobs` DROP FOREIGN KEY `jobs_empresa_id_fkey`;

-- DropForeignKey
ALTER TABLE `jobs` DROP FOREIGN KEY `jobs_mostrar_empresa_id_fkey`;

-- AlterTable
ALTER TABLE `jobs` MODIFY `codigo` VARCHAR(10) NULL,
    MODIFY `empresa_id` INTEGER NOT NULL,
    MODIFY `mostrar_empresa_id` INTEGER NOT NULL;

-- AddForeignKey
ALTER TABLE `jobs` ADD CONSTRAINT `jobs_empresa_id_fkey` FOREIGN KEY (`empresa_id`) REFERENCES `empresas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `jobs` ADD CONSTRAINT `jobs_mostrar_empresa_id_fkey` FOREIGN KEY (`mostrar_empresa_id`) REFERENCES `empresas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
