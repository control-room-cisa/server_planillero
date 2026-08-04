-- AlterTable: snapshot inmutable de banco aplicado a la nómina
ALTER TABLE `nominas` ADD COLUMN `banco_compensatorias_aplicadas` JSON NULL;

-- AlterTable: permitir job no identificado en banco
ALTER TABLE `banco_compensatorias_acumuladas` DROP FOREIGN KEY `banco_compensatorias_acumuladas_id_job_fkey`;

ALTER TABLE `banco_compensatorias_acumuladas` MODIFY `id_job` INTEGER NULL;

ALTER TABLE `banco_compensatorias_acumuladas` ADD CONSTRAINT `banco_compensatorias_acumuladas_id_job_fkey` FOREIGN KEY (`id_job`) REFERENCES `jobs`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
