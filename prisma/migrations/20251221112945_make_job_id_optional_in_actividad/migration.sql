-- DropForeignKey
ALTER TABLE `actividades` DROP FOREIGN KEY `actividades_job_id_fkey`;

-- AlterTable
ALTER TABLE `actividades` MODIFY `job_id` INTEGER NULL;

-- AddForeignKey
ALTER TABLE `actividades` ADD CONSTRAINT `actividades_job_id_fkey` FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
