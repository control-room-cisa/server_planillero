-- CreateTable
CREATE TABLE `prorrateo_comentario_resumenes` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nomina_id` INTEGER NOT NULL,
    `job_id` INTEGER NULL,
    `codigo_job` VARCHAR(10) NULL,
    `nombre_job` VARCHAR(100) NULL,
    `job_key` VARCHAR(40) NOT NULL,
    `resumen` TEXT NOT NULL,
    `created_at` DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NULL,

    INDEX `idx_prorrateo_comentario_resumen_nomina`(`nomina_id`),
    INDEX `idx_prorrateo_comentario_resumen_job`(`job_id`),
    UNIQUE INDEX `uq_prorrateo_comentario_resumen_nomina_job`(`nomina_id`, `job_key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `prorrateo_comentario_resumenes` ADD CONSTRAINT `prorrateo_comentario_resumenes_nomina_id_fkey` FOREIGN KEY (`nomina_id`) REFERENCES `nominas`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `prorrateo_comentario_resumenes` ADD CONSTRAINT `prorrateo_comentario_resumenes_job_id_fkey` FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
