-- CreateTable
CREATE TABLE `roles` (
    `id` INTEGER NOT NULL,
    `nombre` VARCHAR(45) NOT NULL,
    `created_at` DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NULL,
    `deleted_at` DATETIME(3) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `empresas` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `codigo` VARCHAR(45) NULL,
    `nombre` VARCHAR(100) NULL,
    `created_at` DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NULL,
    `deleted_at` DATETIME(3) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `departamentos` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `empresa_id` INTEGER NOT NULL,
    `nombre` VARCHAR(100) NULL,
    `codigo` VARCHAR(45) NULL,
    `created_at` DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NULL,
    `deleted_at` DATETIME(3) NULL,

    INDEX `fk_departamentos_empresas_idx`(`empresa_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `empleados` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `codigo` VARCHAR(20) NULL,
    `nombre` VARCHAR(100) NOT NULL,
    `apellido` VARCHAR(100) NULL,
    `nombreUsuario` VARCHAR(15) NULL,
    `correo_electronico` VARCHAR(45) NULL,
    `dni` VARCHAR(45) NULL,
    `profesion` VARCHAR(30) NULL,
    `tipo_horario` ENUM('H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'H7') NULL,
    `estado_civil` ENUM('Soltero', 'Casado', 'Union Libre') NULL,
    `nombre_conyugue` VARCHAR(40) NULL,
    `cargo` VARCHAR(30) NULL,
    `sueldoMensual` DOUBLE NULL,
    `tipo_contrato` ENUM('7x7', '14x14', 'Indefinido Normal', 'Por Hora', '21x7', 'Temporal') NULL,
    `condicion_salud` VARCHAR(50) NULL,
    `nombre_contacto_emergencia` VARCHAR(40) NULL,
    `numero_contacto_emergencia` VARCHAR(20) NULL,
    `banco` VARCHAR(25) NULL,
    `tipo_cuenta` ENUM('Ahorros moneda nacional', 'Ahorros moneda extranjera', 'Cheques moneda nacional', 'Cheques moneda extranjera') NULL,
    `numero_cuenta` VARCHAR(20) NULL,
    `muerte_beneficiario` VARCHAR(40) NULL,
    `nombre_madre` VARCHAR(40) NULL,
    `nombre_padre` VARCHAR(40) NULL,
    `activo` BOOLEAN NOT NULL DEFAULT true,
    `telefono` VARCHAR(45) NULL,
    `direccion` VARCHAR(250) NULL,
    `fecha_ingreso` DATETIME(3) NULL,
    `contrasena` VARCHAR(255) NULL,
    `url_foto_perfil` VARCHAR(50) NULL,
    `url_cv` VARCHAR(50) NULL,
    `created_at` DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NULL,
    `deleted_at` DATETIME(3) NULL,
    `rolId` INTEGER NOT NULL,
    `departamento_id` INTEGER NOT NULL,

    UNIQUE INDEX `empleados_codigo_key`(`codigo`),
    UNIQUE INDEX `empleados_nombreUsuario_key`(`nombreUsuario`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `planillas` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `fecha_inicio` DATETIME(3) NOT NULL,
    `fecha_fin` DATETIME(3) NOT NULL,
    `estado` ENUM('A', 'R') NOT NULL,
    `empleado_id` INTEGER NOT NULL,
    `empresa_id` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NULL,
    `deleted_at` DATETIME(3) NULL,

    INDEX `fk_planillas_empleados_idx`(`empleado_id`),
    INDEX `fk_planillas_empresas_idx`(`empresa_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `planilla_accesos` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `created_at` DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NULL,
    `deleted_at` DATETIME(3) NULL,
    `supervisor_id` INTEGER NOT NULL,
    `empleado_id` INTEGER NOT NULL,

    INDEX `fk_accesos_supervisor_idx`(`supervisor_id`),
    INDEX `fk_accesos_empleado_idx`(`empleado_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `registros_diarios` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `fecha` VARCHAR(10) NOT NULL,
    `hora_entrada` DATETIME(3) NOT NULL,
    `hora_salida` DATETIME(3) NOT NULL,
    `jornada` VARCHAR(1) NULL,
    `es_dia_libre` BOOLEAN NULL,
    `es_hora_corrida` BOOLEAN NULL,
    `comentarioEmpleado` VARCHAR(500) NULL,
    `aprobacion_supervisor` BOOLEAN NULL,
    `aprobacion_rrhh` BOOLEAN NULL,
    `codigo_supervisor` VARCHAR(45) NULL,
    `codigo_rrhh` VARCHAR(45) NULL,
    `comentario_supervisor` VARCHAR(500) NULL,
    `comentario_rrhh` VARCHAR(500) NULL,
    `empleado_id` INTEGER NOT NULL,
    `created_at` DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NULL,
    `deleted_at` DATETIME(3) NULL,

    INDEX `idx_registro_empleado`(`empleado_id`),
    UNIQUE INDEX `registros_diarios_empleado_id_fecha_key`(`empleado_id`, `fecha`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `actividades` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `registro_diario_id` INTEGER NOT NULL,
    `job_id` INTEGER NOT NULL,
    `duracion_horas` INTEGER NOT NULL,
    `hora_inicio` DATETIME(3) NULL,
    `hora_fin` DATETIME(3) NULL,
    `es_corrida` BOOLEAN NULL,
    `es_extra` BOOLEAN NULL,
    `class` VARCHAR(45) NULL,
    `descripcion` VARCHAR(250) NOT NULL,
    `created_at` DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NULL,
    `deleted_at` DATETIME(3) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `jobs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(45) NULL,
    `codigo` VARCHAR(10) NULL,
    `descripcion` VARCHAR(500) NULL,
    `activo` BOOLEAN NULL,
    `especial` BOOLEAN NULL,
    `created_at` DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NULL,
    `deleted_at` DATETIME(3) NULL,
    `empresa_id` INTEGER NULL,
    `mostrar_empresa_id` INTEGER NULL,

    INDEX `fk_jobs_empresa_idx`(`empresa_id`),
    INDEX `fk_jobs_mostrar_empresa_idx`(`mostrar_empresa_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `feriados` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(45) NOT NULL,
    `fecha` VARCHAR(10) NOT NULL,
    `descripcion` VARCHAR(255) NULL,
    `created_at` DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `feriados_fecha_key`(`fecha`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `departamentos` ADD CONSTRAINT `departamentos_empresa_id_fkey` FOREIGN KEY (`empresa_id`) REFERENCES `empresas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `empleados` ADD CONSTRAINT `empleados_rolId_fkey` FOREIGN KEY (`rolId`) REFERENCES `roles`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `empleados` ADD CONSTRAINT `empleados_departamento_id_fkey` FOREIGN KEY (`departamento_id`) REFERENCES `departamentos`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `planillas` ADD CONSTRAINT `planillas_empleado_id_fkey` FOREIGN KEY (`empleado_id`) REFERENCES `empleados`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `planillas` ADD CONSTRAINT `planillas_empresa_id_fkey` FOREIGN KEY (`empresa_id`) REFERENCES `empresas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `planilla_accesos` ADD CONSTRAINT `planilla_accesos_supervisor_id_fkey` FOREIGN KEY (`supervisor_id`) REFERENCES `empleados`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `planilla_accesos` ADD CONSTRAINT `planilla_accesos_empleado_id_fkey` FOREIGN KEY (`empleado_id`) REFERENCES `empleados`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `registros_diarios` ADD CONSTRAINT `registros_diarios_empleado_id_fkey` FOREIGN KEY (`empleado_id`) REFERENCES `empleados`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `actividades` ADD CONSTRAINT `actividades_registro_diario_id_fkey` FOREIGN KEY (`registro_diario_id`) REFERENCES `registros_diarios`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `actividades` ADD CONSTRAINT `actividades_job_id_fkey` FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `jobs` ADD CONSTRAINT `jobs_empresa_id_fkey` FOREIGN KEY (`empresa_id`) REFERENCES `empresas`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `jobs` ADD CONSTRAINT `jobs_mostrar_empresa_id_fkey` FOREIGN KEY (`mostrar_empresa_id`) REFERENCES `empresas`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
