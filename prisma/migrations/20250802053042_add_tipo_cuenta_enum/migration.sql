/*
  Warnings:

  - You are about to alter the column `tipo_cuenta` on the `empleados` table. The data in that column could be lost. The data in that column will be cast from `VarChar(20)` to `Enum(EnumId(3))`.

*/
-- AlterTable
ALTER TABLE `empleados` MODIFY `tipo_cuenta` ENUM('Ahorros moneda nacional', 'Ahorros moneda extranjera', 'Cheques moneda nacional', 'Cheques moneda extranjera') NULL;
