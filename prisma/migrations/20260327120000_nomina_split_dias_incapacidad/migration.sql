-- Split nominas.dias_incapacidad into empresa / IHSS.
-- Datos previos: el total queda en dias_incapacidad_empresa (sin desglose histórico).

ALTER TABLE `nominas`
  ADD COLUMN `dias_incapacidad_empresa` DOUBLE NULL,
  ADD COLUMN `dias_incapacidad_ihss` DOUBLE NULL;

UPDATE `nominas`
SET
  `dias_incapacidad_empresa` = `dias_incapacidad`,
  `dias_incapacidad_ihss` = 0
WHERE `dias_incapacidad` IS NOT NULL;

ALTER TABLE `nominas` DROP COLUMN `dias_incapacidad`;
