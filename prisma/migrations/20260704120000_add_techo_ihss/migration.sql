-- CreateTable
CREATE TABLE `techo_ihss` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `fecha_creacion` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `fecha_inicio` DATE NOT NULL,
    `fecha_fin` DATE NOT NULL,
    `monto` DOUBLE NOT NULL,
    `updated_at` DATETIME(3) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
