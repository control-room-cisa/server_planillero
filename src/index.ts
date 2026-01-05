import express from "express";
import cors from "cors";
import { authRouter } from "./routes/authRoutes";
import { errorHandler } from "./middlewares/errorHandler";
import { requestContext } from "./middlewares/requestContext";
import { httpLogger } from "./middlewares/httpLogger";
import jobRoutes from "./routes/JobRoutes";
import empresaRoutes from "./routes/empresaRoutes";
import departamentoRoutes from "./routes/departamentoRoutes";
import registroDiarioRoutes from "./routes/RegistroDiarioRoutes";
import empleadoRoutes from "./routes/empleadoRoutes";
import calculoHorasTrabajoRoutes from "./routes/calculoHorasTrabajoRoutes";
import feriadoRoutes from "./routes/FeriadoRoute";
import nominaRoutes from "./routes/NominaRoutes";
import planillaAccesoRevisionRoutes from "./routes/PlanillaAccesoRevisionRoutes";
import deduccionAlimentacionRoutes from "./routes/deduccionAlimentacionRoutes";

import path from "path";
import { config } from "dotenv";

const app = express();

const ROOT = path.resolve(__dirname, "..");
config({ path: path.join(ROOT, ".env") });

app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

// Correlation id (X-Request-Id) and request logging (one line per request)
app.use(requestContext);
app.use(httpLogger);

// Configurar CORS para permitir requests desde el frontend
app.use(
  cors({
    origin: true, // Permitir todos los orígenes en desarrollo
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "X-Request-Id",
    ],
    exposedHeaders: ["X-Request-Id"],
  })
);

app.use(express.json());
app.use("/api/auth", authRouter);
app.use("/api/jobs", jobRoutes);
app.use("/api/empresas", empresaRoutes);
app.use("/api/departamentos", departamentoRoutes);
app.use("/api/registrodiario", registroDiarioRoutes);
app.use("/api/empleados", empleadoRoutes);
app.use("/api/calculo-horas", calculoHorasTrabajoRoutes);
app.use("/api/feriados", feriadoRoutes);
app.use("/api/nominas", nominaRoutes);
app.use("/api/planilla-acceso-revision", planillaAccesoRevisionRoutes);
app.use("/api/deduccion-alimentacion", deduccionAlimentacionRoutes);

app.use(errorHandler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});
