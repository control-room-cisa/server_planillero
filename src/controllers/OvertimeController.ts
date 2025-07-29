
import { Request, Response } from 'express';
import { OvertimeService } from '../services/OvertimeService';
import { CalculateOvertimePeriodRequest } from '../dtos/OvertimeRule';

const overtimeService = new OvertimeService();

export async function calculateSummaryPeriod(
  req: Request,
  res: Response
) {
  const { empleadoId, fechaInicio, fechaFin } = req.body as CalculateOvertimePeriodRequest;
  // …validaciones…
  const conteoHoras = await overtimeService.calculateSummaryForPeriod({ empleadoId, fechaInicio, fechaFin });
  return res.json(conteoHoras);
}