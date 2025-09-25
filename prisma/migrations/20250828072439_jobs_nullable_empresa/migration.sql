/*
  Warnings:

  - A unique constraint covering the columns `[nombreUsuario]` on the table `empleados` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE `jobs` DROP FOREIGN KEY `jobs_empresa_id_fkey`;

-- DropForeignKey
ALTER TABLE `jobs` DROP FOREIGN KEY `jobs_mostrar_empresa_id_fkey`;

-- AlterTable
ALTER TABLE `jobs` MODIFY `empresa_id` INTEGER NULL,
    MODIFY `mostrar_empresa_id` INTEGER NULL;

-- CreateIndex
CREATE UNIQUE INDEX `empleados_nombreUsuario_key` ON `empleados`(`nombreUsuario`);

-- AddForeignKey
ALTER TABLE `jobs` ADD CONSTRAINT `jobs_empresa_id_fkey` FOREIGN KEY (`empresa_id`) REFERENCES `empresas`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `jobs` ADD CONSTRAINT `jobs_mostrar_empresa_id_fkey` FOREIGN KEY (`mostrar_empresa_id`) REFERENCES `empresas`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
