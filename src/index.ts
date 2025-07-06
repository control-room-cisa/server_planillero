import express from 'express';
import { authRouter } from './routes/authRoutes';
import { errorHandler } from './middlewares/errorHandler';
import planillaRouter from './routes/planillaRoutes';
import jobRoutes      from './routes/JobRoutes';
import empresaRoutes  from './routes/empresaRoutes';

const app = express();

app.use(express.json());
app.use('/api/auth', authRouter);
app.use('/api/planillas', planillaRouter);
app.use("/api/jobs", jobRoutes);
app.use("/api/empresas", empresaRoutes);
app.use(errorHandler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});
