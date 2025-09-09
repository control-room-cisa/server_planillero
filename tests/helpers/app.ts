import express from 'express';
import registroDiarioRouter from '../../src/routes/RegistroDiarioRoutes';
import calculoHorasRouter from '../../src/routes/calculoHorasTrabajoRoutes';
import { errorHandler } from '../../src/middlewares/errorHandler';

export function buildTestApp() {
  const app = express();
  app.use(express.json());

  // Mount only the routes under test
  app.use('/api/registrodiario', registroDiarioRouter);
  app.use('/api/calculo-horas', calculoHorasRouter);

  app.use(errorHandler);
  return app;
}
