import express from "express";
import cors from "cors";
import { connectDBPlanillero } from "./src/config/connectDB.js";
import authRoutes from "./src/routes/auth/routes.js";
import planilleroRoutes from "./src/routes/planillero/routes.js";
import adminRoutes from "./src/routes/planillero/administrator/routes.js";

import path from "path";
import { fileURLToPath } from "url";

const app = express();
const PORT = process.env.PORT || 5700;

app.use((req, res, next) => {
    res.header("Access-Control-Allow-Credentials", true);
    next();
});
app.use(express.json());
app.use(cors());

app.use('/api', authRoutes);
app.use('/api', planilleroRoutes);
app.use('/api', adminRoutes);

// Resolver __dirname para ESModules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Servir los archivos desde /client/build
app.use(express.static(path.resolve(__dirname, "../client/build")));

app.get(/^\/(?!api).*/, (req, res) => {
  res.sendFile(path.resolve(__dirname, "../client/build", "index.html"));
});

app.listen(PORT, async () => {
  try {
    const [rows] = await connectDBPlanillero.query('SELECT DATABASE() AS db');
    console.log('✅ Conectado a la base de datos:', rows[0].db);
    console.log('🚀 Servidor escuchando en el puerto:', PORT);
  } catch (err) {
    console.error('❌ Error al conectar a la base de datos:', err.message);
  }
});
