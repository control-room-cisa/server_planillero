-- CreateTable
CREATE TABLE `historial_salarios` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `empleado_id` INTEGER NOT NULL,
    `sueldo_mensual` DOUBLE NOT NULL,
    `fecha_vigencia` DATE NOT NULL,
    `created_at` DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
    `created_by_id` INTEGER NULL,

    INDEX `idx_historial_salarios_empleado_vigencia`(`empleado_id`, `fecha_vigencia`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `historial_salarios` ADD CONSTRAINT `historial_salarios_empleado_id_fkey` FOREIGN KEY (`empleado_id`) REFERENCES `empleados`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `historial_salarios` ADD CONSTRAINT `historial_salarios_created_by_id_fkey` FOREIGN KEY (`created_by_id`) REFERENCES `empleados`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: un registro inicial por colaborador con sueldo actual
INSERT INTO `historial_salarios` (`empleado_id`, `sueldo_mensual`, `fecha_vigencia`, `created_at`)
SELECT
  e.`id`,
  COALESCE(e.`sueldoMensual`, 0),
  COALESCE(DATE(e.`fecha_ingreso`), DATE(e.`created_at`), CURDATE()),
  NOW(3)
FROM `empleados` e
WHERE e.`deleted_at` IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM `historial_salarios` h WHERE h.`empleado_id` = e.`id`
  );
