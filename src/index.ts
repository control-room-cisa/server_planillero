import express from "express";
import cors from "cors";
import { authRouter } from "./routes/authRoutes";
import { errorHandler } from "./middlewares/errorHandler";
import planillaRouter from "./routes/planillaRoutes";
import jobRoutes from "./routes/JobRoutes";
import empresaRoutes from "./routes/empresaRoutes";
import registroDiarioRoutes from "./routes/RegistroDiarioRoutes";
import empleadoRoutes from "./routes/empleadoRoutes";
import calculoHorasTrabajoRoutes from "./routes/calculoHorasTrabajoRoutes";
import overtimeRoutes from "./routes/overtimeRoutes";
import feriadoRoutes from "./routes/FeriadoRoute";
import path from "path";

const app = express();

app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));
// Configurar CORS para permitir requests desde el frontend
app.use(
  cors({
    origin: true, // Permitir todos los orígenes en desarrollo
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  })
);

app.use(express.json());
app.use("/api/auth", authRouter);
app.use("/api/planillas", planillaRouter);
app.use("/api/jobs", jobRoutes);
app.use("/api/empresas", empresaRoutes);
app.use("/api/registrodiario", registroDiarioRoutes);
app.use("/api/empleados", empleadoRoutes);
app.use("/api/calculo-horas", calculoHorasTrabajoRoutes);
app.use("/api/feriados", feriadoRoutes);
app.use("/api", overtimeRoutes);

app.use(errorHandler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});
