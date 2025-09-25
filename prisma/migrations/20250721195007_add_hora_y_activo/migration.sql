/*
  Warnings:

  - You are about to drop the column `horas_diarias_trabajadas` on the `empleados` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `actividades` ADD COLUMN `es_corrida` BOOLEAN NULL,
    ADD COLUMN `hora_fin` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `hora_inicio` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);

-- AlterTable
ALTER TABLE `empleados` DROP COLUMN `horas_diarias_trabajadas`,
    ADD COLUMN `activo` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `banco` VARCHAR(25) NULL,
    ADD COLUMN `cargo` VARCHAR(30) NULL,
    ADD COLUMN `condicion_salud` VARCHAR(50) NULL,
    ADD COLUMN `direccion` VARCHAR(250) NULL,
    ADD COLUMN `estado_civil` ENUM('Soltero', 'Casado', 'Union Libre') NULL,
    ADD COLUMN `fecha_ingreso` DATETIME(3) NULL,
    ADD COLUMN `muerte_beneficiario` VARCHAR(40) NULL,
    ADD COLUMN `nombreUsuario` VARCHAR(15) NULL,
    ADD COLUMN `nombre_contacto_emergencia` VARCHAR(40) NULL,
    ADD COLUMN `nombre_conyugue` VARCHAR(40) NULL,
    ADD COLUMN `nombre_madre` VARCHAR(40) NULL,
    ADD COLUMN `nombre_padre` VARCHAR(40) NULL,
    ADD COLUMN `numero_contacto_emergencia` VARCHAR(20) NULL,
    ADD COLUMN `numero_cuenta` VARCHAR(20) NULL,
    ADD COLUMN `profesion` VARCHAR(30) NULL,
    ADD COLUMN `sueldoMensual` DOUBLE NULL,
    ADD COLUMN `telefono` VARCHAR(45) NULL,
    ADD COLUMN `tipo_contrato` ENUM('7x7', '14x14', 'Indefinido Normal', 'Por Hora', '21x7', 'Temporal') NULL,
    ADD COLUMN `tipo_cuenta` VARCHAR(20) NULL,
    ADD COLUMN `tipo_horario` ENUM('H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'H7') NULL,
    ADD COLUMN `url_cv` VARCHAR(50) NULL,
    ADD COLUMN `url_foto_perfil` VARCHAR(50) NULL;
