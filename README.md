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

- dtos/: definiciones de payloads de entrada/salida

## 🔧 Uso de Prisma y migraciones

1. Definir el modelo en prisma/schema.prisma.
2. Cada vez que cambies el esquema:

        `npx prisma migrate dev --name <descriptivo>`
    - Crea una carpeta en prisma/migrations/....

    - Aplica automáticamente los cambios a tu BD local.
3. Generar el cliente tras cualquier modificación:
    
        `npx prisma generate`
4. Puedes inspeccionar y editar datos con:
    
        `npx prisma studio`

5. En producción, aplica migraciones ya generadas con:

        `NODE_ENV=production npx prisma migrate deploy`