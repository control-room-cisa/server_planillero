-- AlterTable
ALTER TABLE `nominas` ADD COLUMN `horas_compensatorias` DOUBLE NULL;

-- CreateTable
CREATE TABLE `global_config` (
    `key` VARCHAR(100) NOT NULL,
    `value` VARCHAR(255) NOT NULL,
    `description` VARCHAR(255) NULL,
    `created_at` DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NULL,

    PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
