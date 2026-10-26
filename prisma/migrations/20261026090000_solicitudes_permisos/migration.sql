-- CreateTable
CREATE TABLE `solicitudes_permisos` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `empleado_solicitante_id` INTEGER NOT NULL,
    `tipo` ENUM('VACACIONES', 'PERMISO') NOT NULL,
    `comentario` VARCHAR(500) NULL,
    `aprobacion_supervisor` BOOLEAN NULL,
    `aprobacion_rrhh` BOOLEAN NULL,
    `comentario_supervisor` VARCHAR(500) NULL,
    `comentario_rrhh` VARCHAR(500) NULL,
    `aprobador_supervisor_id` INTEGER NULL,
    `aprobador_rrhh_id` INTEGER NULL,
    `fecha_aprobacion_supervisor` DATETIME(3) NULL,
    `fecha_aprobacion_rrhh` DATETIME(3) NULL,
    `created_at` DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NULL,
    `deleted_at` DATETIME(3) NULL,
    `updated_by` INTEGER NULL,

    INDEX `idx_solicitud_permiso_solicitante`(`empleado_solicitante_id`),
    INDEX `idx_solicitud_permiso_aprob_sup`(`aprobacion_supervisor`),
    INDEX `fk_solicitud_permiso_aprobador_sup`(`aprobador_supervisor_id`),
    INDEX `fk_solicitud_permiso_aprobador_rrhh`(`aprobador_rrhh_id`),
    INDEX `fk_solicitud_permiso_updated_by`(`updated_by`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `solicitud_permiso_dias` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `solicitud_id` INTEGER NOT NULL,
    `fecha` VARCHAR(10) NOT NULL,
    `comentario_horario` VARCHAR(200) NULL,

    INDEX `idx_solicitud_permiso_dia_fecha`(`fecha`),
    UNIQUE INDEX `uq_solicitud_permiso_dia`(`solicitud_id`, `fecha`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `solicitudes_permisos` ADD CONSTRAINT `solicitudes_permisos_empleado_solicitante_id_fkey` FOREIGN KEY (`empleado_solicitante_id`) REFERENCES `empleados`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `solicitudes_permisos` ADD CONSTRAINT `solicitudes_permisos_aprobador_supervisor_id_fkey` FOREIGN KEY (`aprobador_supervisor_id`) REFERENCES `empleados`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `solicitudes_permisos` ADD CONSTRAINT `solicitudes_permisos_aprobador_rrhh_id_fkey` FOREIGN KEY (`aprobador_rrhh_id`) REFERENCES `empleados`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `solicitudes_permisos` ADD CONSTRAINT `solicitudes_permisos_updated_by_fkey` FOREIGN KEY (`updated_by`) REFERENCES `empleados`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `solicitud_permiso_dias` ADD CONSTRAINT `solicitud_permiso_dias_solicitud_id_fkey` FOREIGN KEY (`solicitud_id`) REFERENCES `solicitudes_permisos`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
