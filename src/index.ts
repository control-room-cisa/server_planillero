import "./config/loadEnv";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import { authRouter } from "./routes/authRoutes";
import { errorHandler } from "./middlewares/errorHandler";
import { requestContext } from "./middlewares/requestContext";
import { httpLogger } from "./middlewares/httpLogger";
import { authenticateJWTOrQueryToken } from "./middlewares/authenticateJWTOrQueryToken";
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
import globalConfigRoutes from "./routes/globalConfigRoutes";
import rangosFechasAlimentacionRoutes from "./routes/rangosFechasAlimentacionRoutes";
import techoIhssRoutes from "./routes/techoIhssRoutes";
import vehiculoRoutes from "./routes/VehiculoRoutes";
import accesoContabilidadRoutes from "./routes/accesoContabilidadRoutes";
import prorrateoRoutes from "./routes/ProrrateoRoutes";
import { startFlotaUsuarioSyncCron } from "./jobs/flotaUsuarioSyncCron";
import { assertJwtSecretConfigured } from "./config/jwt";
import { assertCorsConfigured, getCorsOrigins } from "./config/cors";

import path from "path";

assertJwtSecretConfigured();
assertCorsConfigured();

const app = express();

// Necesario para rate-limit por IP real detrás de nginx/proxy
if (process.env.TRUST_PROXY === "1" || process.env.TRUST_PROXY === "true") {
  app.set("trust proxy", 1);
}

app.use(helmet());

// Correlation id (X-Request-Id) and request logging (one line per request)
app.use(requestContext);
app.use(httpLogger);

const corsOrigins = getCorsOrigins();
app.use(
  cors({
    origin: (origin, callback) => {
      // Requests sin Origin (Postman, same-origin server-side, etc.)
      if (!origin || corsOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(null, false);
    },
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

// Uploads: requieren sesión (Bearer o ?token= para <img>/<a>)
app.use(
  "/uploads",
  authenticateJWTOrQueryToken,
  express.static(path.join(process.cwd(), "uploads"))
);

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
app.use("/api/global-config", globalConfigRoutes);
app.use("/api/rangos-fechas-alimentacion", rangosFechasAlimentacionRoutes);
app.use("/api/techo-ihss", techoIhssRoutes);
app.use("/api/vehiculos", vehiculoRoutes);
app.use("/api/accesos-contabilidad", accesoContabilidadRoutes);
app.use("/api/prorrateos", prorrateoRoutes);

app.use(errorHandler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
  console.log(`CORS orígenes: ${corsOrigins.join(", ")}`);
  startFlotaUsuarioSyncCron();
});
