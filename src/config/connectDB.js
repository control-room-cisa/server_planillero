import { createPool } from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const connectDBPlanillero = createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
});

console.log('Conexión a base de datos exitosa!');

export { connectDBPlanillero };