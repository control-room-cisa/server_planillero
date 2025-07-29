import express from "express";
import cors from "cors";
import { authRouter } from "./routes/authRoutes";
import { errorHandler } from "./middlewares/errorHandler";
import planillaRouter from "./routes/planillaRoutes";
import jobRoutes from "./routes/JobRoutes";
import empresaRoutes from "./routes/empresaRoutes";
import registroDiarioRoutes from "./routes/RegistroDiarioRoutes";
import empleadoRoutes from "./routes/empleadoRoutes";
import overtimeRoutes from "./routes/overtimeRoutes";

const app = express();

// Configurar CORS para permitir requests desde el frontend
app.use(
  cors({
    origin: ["http://localhost:5173", "http://127.0.0.1:5173"],
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json());
app.use("/api/auth", authRouter);
app.use("/api/planillas", planillaRouter);
app.use("/api/jobs", jobRoutes);
app.use("/api/empresas", empresaRoutes);
app.use("/api/registrodiario", registroDiarioRoutes);
app.use("/api/empleados", empleadoRoutes);
app.use("/api", overtimeRoutes);

app.use(errorHandler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});
