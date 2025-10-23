/*
  Warnings:

  - You are about to alter the column `duracion_horas` on the `actividades` table. The data in that column could be lost. The data in that column will be cast from `Int` to `Double`.

*/
-- AlterTable
ALTER TABLE `actividades` MODIFY `duracion_horas` DOUBLE NOT NULL;

-- AlterTable
ALTER TABLE `registros_diarios` ADD COLUMN `horas_feriado` DOUBLE NULL;
