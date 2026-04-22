-- CreateTable
CREATE TABLE `rangos_fechas_alimentacion` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `codigo_nomina` VARCHAR(20) NOT NULL,
    `fecha_inicio` DATE NOT NULL,
    `fecha_fin` DATE NOT NULL,
    `created_at` DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NULL,

    UNIQUE INDEX `rangos_fechas_alimentacion_codigo_nomina_key`(`codigo_nomina`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
