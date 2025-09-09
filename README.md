# Planillero-Backend

Aplicación RESTful construida con Node.js, TypeScript, Express y Prisma ORM sobre MySQL para gestionar planillas y registros diarios de empleados.

---

## 📋 Requisitos

- Node.js ≥ 16
- npm ≥ 8
- MySQL (o MariaDB)

---

## 🚀 Instalación y puesta en marcha

1. **Clonar el repositorio**

   ```bash
   git clone https://github.com/angelflxgrp/server_planillero.git planillero-backend
   cd planillero-backend

   ```

2. **Instalar dependencias**
   `npm install`

3. **Configurar variables de entorno**
   copiar el archivo `.env.example` y cambiar el nombre a `.env` .
   Aplicar configuraciones de base de datos y clave de jwt token.
   `DATABASE_URL="mysql://USER:PASS@HOST:PORT/planillero"
JWT_SECRET="una_clave_secreta_para_jwt"
`
4. **Aplicar migraciones y generar cliente Prisma**

   ### Crea la migración inicial (o nuevas migraciones tras cambios)

   `npx prisma migrate deploy`

   ### Genera (o regenera) el cliente de Prisma

   `npx prisma generate`

   ### Aplicar semillero en base de datos

   `npx prisma db seed`

5. **Scripts disponibles**

   `npm run dev`
   Arranca en modo desarrollo con recarga automática (ts-node-dev).

   `npm run build`
   Transpila TypeScript a JavaScript en dist/

   `npm run prisma`
   Atajo al CLI de Prisma (npx prisma …).

## 🗄️ Arquitectura por capas

- routes/: definiciones de rutas Express

- controllers/: orquestan petición/respuesta

- services/: lógica de negocio

- repositories/: acceso a BD vía Prisma

- middlewares/: validación, autenticación, manejo de errores

- dtos/: definiciones de payloads de entrada/salida en controladores

- types/: modelos de datos para su uso en servicios

## 🔧 Uso de Prisma y migraciones

### 1. Desarrollo (rama `dev`)

1. Edita tu `schema.prisma`.
2. Genera y aplica la migración localmente (incluye `prisma generate`):
   ```bash
   npx prisma migrate dev --name <descripción_cambios>
   ```
3. Prueba tu app y commitea schema.prisma, la carpeta `prisma/migrations/*` y tus cambios de código.

### 2. Staging (Testing)

1.  Asegúrate de tener el cliente Prisma al día:

        npx prisma generate

2.  Aplica todas las migraciones pendientes:

        npx prisma migrate deploy

3.  Ejecuta tus pruebas de integración / QA.

### 3. Producción (rama deploy)

1.  Backup de la base de datos.
2.  Regenera el cliente Prisma:

        npx prisma generate

3.  Aplica migraciones en producción:

        npx prisma migrate deploy

4.  (Opcional) Inserta datos semilla críticos:

        npx prisma db seed

---

## Pruebas (Vitest)

- Requisitos: Node.js y dependencias instaladas (`npm install`).
- El proyecto trae unit tests (sin BD) e integraciones/E2E (con BD MySQL opcional).

### Configuración de base de datos de pruebas (.env.test)

Crear un archivo `.env.test` en la raíz con, por ejemplo:

```
DATABASE_URL="mysql://root@localhost:3306/planillero-test"

```

Crear la base de datos para pruebas (nota: el guion requiere backticks en MySQL):

```sql
CREATE DATABASE `planillero-test` CHARACTER SET utf8mb4;
```


### Ejecutar pruebas con base de datos (integración/E2E)

1) Asegura que `.env.test` apunte a tu BD de pruebas y que la BD exista.

2) Ejecuta con BD habilitada:

- El setup global carga `.env.test` y ejecuta `npx prisma generate`.
- Por defecto hace `npx prisma db push --force-reset` (borra datos). Si no quieres resetear:

```
TEST_DB_RESET=0 RUN_DB_TESTS=1 npx vitest run
```

- Semilla opcional: activa con `RUN_DB_SEED=1`.

### Modo watch y cobertura

- Watch:

```
npm run test:watch
```

- Cobertura:

```
npm run test:cov
npm run coverage:open
```
