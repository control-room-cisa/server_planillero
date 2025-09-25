/*
  Warnings:

  - You are about to drop the `feriado` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE `feriado`;

-- CreateTable
CREATE TABLE `Feriados` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(45) NOT NULL,
    `fecha` VARCHAR(10) NOT NULL,
    `created_at` DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `Feriados_fecha_key`(`fecha`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
