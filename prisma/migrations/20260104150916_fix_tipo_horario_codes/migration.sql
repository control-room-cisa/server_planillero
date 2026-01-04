/*
  Warnings:

  - The values [H1,H2,H3,H4,H5,H6,H7] on the enum `empleados_tipo_horario` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterTable
ALTER TABLE `empleados` MODIFY `tipo_horario` ENUM('H1_1', 'H1_2', 'H1_3', 'H1_4', 'H1_5', 'H1_6', 'H2_1', 'H2_2') NULL;
