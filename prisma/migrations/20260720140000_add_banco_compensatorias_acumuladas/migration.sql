-- CreateTable
CREATE TABLE `banco_compensatorias_acumuladas` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `id_job` INTEGER NOT NULL,
    `id_empleado` INTEGER NOT NULL,
    `horas_acumuladas` DOUBLE NOT NULL,

    INDEX `idx_banco_comp_empleado`(`id_empleado`),
    INDEX `idx_banco_comp_job`(`id_job`),
    UNIQUE INDEX `uq_banco_comp_empleado_job`(`id_empleado`, `id_job`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `banco_compensatorias_acumuladas` ADD CONSTRAINT `banco_compensatorias_acumuladas_id_job_fkey` FOREIGN KEY (`id_job`) REFERENCES `jobs`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `banco_compensatorias_acumuladas` ADD CONSTRAINT `banco_compensatorias_acumuladas_id_empleado_fkey` FOREIGN KEY (`id_empleado`) REFERENCES `empleados`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
