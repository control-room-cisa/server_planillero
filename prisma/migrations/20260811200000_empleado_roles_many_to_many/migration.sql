-- CreateTable
CREATE TABLE `empleado_roles` (
    `empleado_id` INTEGER NOT NULL,
    `rol_id` INTEGER NOT NULL,

    INDEX `fk_empleado_roles_rol_idx`(`rol_id`),
    PRIMARY KEY (`empleado_id`, `rol_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `empleado_roles` ADD CONSTRAINT `empleado_roles_empleado_id_fkey` FOREIGN KEY (`empleado_id`) REFERENCES `empleados`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `empleado_roles` ADD CONSTRAINT `empleado_roles_rol_id_fkey` FOREIGN KEY (`rol_id`) REFERENCES `roles`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill: rol actual de cada empleado
INSERT INTO `empleado_roles` (`empleado_id`, `rol_id`)
SELECT `id`, `rolId` FROM `empleados`
WHERE `rolId` IS NOT NULL;

-- Backfill 1.B: asignar EMPLEADO (id=1) a todos por defecto.
-- La mayoría de usuarios lo tienen; en UI se puede desmarcar a quienes no lo necesiten.
INSERT IGNORE INTO `empleado_roles` (`empleado_id`, `rol_id`)
SELECT `id`, 1 FROM `empleados`;

-- Drop FK and column rolId
ALTER TABLE `empleados` DROP FOREIGN KEY `empleados_rolId_fkey`;
ALTER TABLE `empleados` DROP COLUMN `rolId`;
