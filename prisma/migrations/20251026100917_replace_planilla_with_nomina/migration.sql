/*
  Warnings:

  - You are about to drop the `planillas` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE `planillas` DROP FOREIGN KEY `planillas_empleado_id_fkey`;

-- DropForeignKey
ALTER TABLE `planillas` DROP FOREIGN KEY `planillas_empresa_id_fkey`;

-- DropTable
DROP TABLE `planillas`;

-- CreateTable
CREATE TABLE `nominas` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `empleado_id` INTEGER NOT NULL,
    `empresa_id` INTEGER NOT NULL,
    `nombre_nomina` VARCHAR(100) NULL,
    `fecha_inicio` DATETIME(3) NOT NULL,
    `fecha_fin` DATETIME(3) NOT NULL,
    `sueldo_mensual` DOUBLE NOT NULL,
    `dias_laborados` DOUBLE NULL,
    `dias_vacaciones` DOUBLE NULL,
    `dias_incapacidad` DOUBLE NULL,
    `subtotal_quincena` DOUBLE NULL,
    `monto_vacaciones` DOUBLE NULL,
    `monto_dias_laborados` DOUBLE NULL,
    `monto_excedente_ihss` DOUBLE NULL,
    `monto_incapacidad_cubre_empresa` DOUBLE NULL,
    `monto_ot_25` DOUBLE NULL,
    `monto_ot_50` DOUBLE NULL,
    `monto_ot_75` DOUBLE NULL,
    `monto_ot_100` DOUBLE NULL,
    `ajuste` DOUBLE NULL,
    `total_percepciones` DOUBLE NULL,
    `deduccion_ihss` DOUBLE NULL,
    `deduccion_isr` DOUBLE NULL,
    `deduccion_rap` DOUBLE NULL,
    `deduccion_alimentacion` DOUBLE NULL,
    `cobro_prestamo` DOUBLE NULL,
    `impuesto_vecinal` DOUBLE NULL,
    `otros` DOUBLE NULL,
    `total_deducciones` DOUBLE NULL,
    `total_neto_pagar` DOUBLE NULL,
    `codigo_empleado_creacion` VARCHAR(20) NULL,
    `created_at` DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NULL,
    `deleted_at` DATETIME(3) NULL,

    INDEX `idx_nominas_empleado`(`empleado_id`),
    INDEX `idx_nominas_empresa`(`empresa_id`),
    UNIQUE INDEX `nominas_empleado_id_fecha_inicio_fecha_fin_key`(`empleado_id`, `fecha_inicio`, `fecha_fin`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `nominas` ADD CONSTRAINT `nominas_empleado_id_fkey` FOREIGN KEY (`empleado_id`) REFERENCES `empleados`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `nominas` ADD CONSTRAINT `nominas_empresa_id_fkey` FOREIGN KEY (`empresa_id`) REFERENCES `empresas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
