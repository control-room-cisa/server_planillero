import { RequestHandler } from "express";
import { ApiResponse } from "../dtos/ApiResponse";
import { getPeriodosNominaConfig } from "../config/periodosNomina";
import {
  describirCortes,
  type PeriodosNominaConfig,
} from "../domain/nomina/periodosNomina";

export type PeriodosNominaConfigResponse = PeriodosNominaConfig & {
  descripcionCortes: string;
};

/** GET /api/periodos-nomina/config */
export const getPeriodosNominaConfigHandler: RequestHandler<
  {},
  ApiResponse<PeriodosNominaConfigResponse>
> = async (_req, res, next) => {
  try {
    const config = getPeriodosNominaConfig();
    return res.json({
      success: true,
      message: "Configuración de cortes de quincena",
      data: {
        ...config,
        descripcionCortes: describirCortes(config),
      },
    });
  } catch (err) {
    next(err);
  }
};
