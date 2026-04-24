-- Crear catalogo de vehiculos y relacionarlo con actividades.class
-- sin romper data existente que actualmente viene como texto numerico.

CREATE TABLE `vehiculos` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `class` INTEGER NOT NULL,
  `nombre` VARCHAR(255) NOT NULL,
  `tipo` VARCHAR(20) NULL,
  `created_at` DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NULL,
  `deleted_at` DATETIME(3) NULL,

  UNIQUE INDEX `vehiculos_class_key`(`class`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Sembrar vehiculos con los class ya existentes para permitir el FK.
INSERT INTO `vehiculos` (`class`, `nombre`)
SELECT DISTINCT
  CAST(TRIM(`class`) AS UNSIGNED),
  CONCAT('Vehiculo ', TRIM(`class`))
FROM `actividades`
WHERE `class` IS NOT NULL
  AND TRIM(`class`) <> ''
  AND TRIM(`class`) REGEXP '^[0-9]+$';

-- Cualquier valor no numerico se limpia a NULL para permitir conversion segura.
UPDATE `actividades`
SET `class` = NULL
WHERE `class` IS NOT NULL
  AND (
    TRIM(`class`) = ''
    OR TRIM(`class`) NOT REGEXP '^[0-9]+$'
  );

ALTER TABLE `actividades`
  MODIFY `class` INTEGER NULL;

CREATE INDEX `idx_actividades_class` ON `actividades`(`class`);

ALTER TABLE `actividades`
  ADD CONSTRAINT `actividades_class_fkey`
  FOREIGN KEY (`class`) REFERENCES `vehiculos`(`class`)
  ON DELETE SET NULL
  ON UPDATE CASCADE;
