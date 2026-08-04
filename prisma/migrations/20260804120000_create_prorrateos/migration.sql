-- CreateEnum
CREATE TABLE `prorrateos` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nomina_id` INTEGER NOT NULL,
    `job_id` INTEGER NULL,
    `codigo_job` VARCHAR(10) NULL,
    `codigo_class` VARCHAR(20) NULL,
    `cantidad_horas` DOUBLE NOT NULL,
    `monto` DOUBLE NOT NULL DEFAULT 0,
    `tipo` ENUM('normal', 'extra25', 'extra50', 'extra75', 'extra100', 'compensatoriaTomada', 'compensatoriaAcumulada') NOT NULL,
    `created_at` DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NULL,

    INDEX `idx_prorrateos_nomina`(`nomina_id`),
    INDEX `idx_prorrateos_job`(`job_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `prorrateos` ADD CONSTRAINT `prorrateos_nomina_id_fkey` FOREIGN KEY (`nomina_id`) REFERENCES `nominas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `prorrateos` ADD CONSTRAINT `prorrateos_job_id_fkey` FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
