-- CreateTable
CREATE TABLE `accesos_contabilidad` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `id_empleado` INTEGER NOT NULL,
    `id_empresa` INTEGER NOT NULL,
    `created_by` INTEGER NOT NULL,
    `created_at` DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_by` INTEGER NULL,
    `updated_at` DATETIME(3) NULL,
    `deleted_at` DATETIME(3) NULL,

    INDEX `idx_accesos_contabilidad_empleado`(`id_empleado`),
    INDEX `idx_accesos_contabilidad_empresa`(`id_empresa`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `accesos_contabilidad` ADD CONSTRAINT `accesos_contabilidad_id_empleado_fkey` FOREIGN KEY (`id_empleado`) REFERENCES `empleados`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `accesos_contabilidad` ADD CONSTRAINT `accesos_contabilidad_id_empresa_fkey` FOREIGN KEY (`id_empresa`) REFERENCES `empresas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `accesos_contabilidad` ADD CONSTRAINT `accesos_contabilidad_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `empleados`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `accesos_contabilidad` ADD CONSTRAINT `accesos_contabilidad_updated_by_fkey` FOREIGN KEY (`updated_by`) REFERENCES `empleados`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
