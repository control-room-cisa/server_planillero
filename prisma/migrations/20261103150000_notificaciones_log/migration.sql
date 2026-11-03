-- CreateTable
CREATE TABLE `notificaciones_log` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `destinatario_id` INTEGER NOT NULL,
    `actor_id` INTEGER NULL,
    `categoria` VARCHAR(50) NOT NULL,
    `descripcion` VARCHAR(500) NOT NULL,
    `leida` BOOLEAN NOT NULL DEFAULT false,
    `leida_at` DATETIME(3) NULL,
    `metadata` JSON NULL,
    `created_at` DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `idx_notif_destinatario_leida_fecha`(`destinatario_id`, `leida`, `created_at`),
    INDEX `idx_notif_categoria`(`categoria`),
    INDEX `idx_notif_actor`(`actor_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `notificaciones_log` ADD CONSTRAINT `notificaciones_log_destinatario_id_fkey` FOREIGN KEY (`destinatario_id`) REFERENCES `empleados`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notificaciones_log` ADD CONSTRAINT `notificaciones_log_actor_id_fkey` FOREIGN KEY (`actor_id`) REFERENCES `empleados`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
