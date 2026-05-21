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

   **Sincronización de usuarios hacia Gestión de Flota** (mismo servidor, solo localhost):

   | Variable | Descripción |
   |----------|-------------|
   | `FLOTA_API_PORT` | Puerto HTTP del backend de Flota (mismo valor que `PORT` en Flota) |
   | `FLOTA_WEBHOOK_SYNC_SECRET` | Mismo valor que `WEBHOOK_SYNC_SECRET` en el `.env` de Flota |
   | `FLOTA_WEBHOOK_SYNC_URL` | Opcional. Default: `http://127.0.0.1:${FLOTA_API_PORT}/api/webhooks/usuarios/sync` |
   | `FLOTA_SYNC_CRON_ENABLED` | Opcional. `false` desactiva el cron diario |
   | `FLOTA_SYNC_CRON_TZ` | Opcional. Zona horaria del cron (default `America/Tegucigalpa`) |

   - Tras cada create/update en `empleados`, Planillero envía el usuario a Flota (debounced).
   - Cron diario a las **02:00** sincroniza todos los empleados activos en lotes de 500.
   - Checklist: mismo secreto en ambos `.env`, probar con un empleado antes del lote completo, códigos de `empresas.codigo` alineados en Flota.
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
