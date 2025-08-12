import dayjs from "dayjs";
import { OvertimeRepository } from "../repositories/OvertimeRepository";
import { OvertimeRulesEngine } from "./OvertimeRulesEngine";
import { allOvertimeRules } from "./OvertimeRulesService";
import {
  CalculateOvertimePeriodRequest,
  OvertimeDetail,
  OvertimeResponse,
} from "../dtos/OvertimeRule";

export class OvertimeService {
  private engine = new OvertimeRulesEngine(allOvertimeRules);

  constructor(private repo = new OvertimeRepository()) {}

  async calculateSummaryForPeriod(
    params: CalculateOvertimePeriodRequest
  ): Promise<OvertimeResponse> {
    const { empleadoId, fechaInicio, fechaFin } = params;
    const registros = await this.repo.findByEmpleadoAndDateRange(
      empleadoId,
      fechaInicio,
      fechaFin
    );

    const response: OvertimeResponse = {
      empleadoId,
      periodo: { desde: fechaInicio, hasta: fechaFin },
      conteoHoras: {
        horasNormal: 0,
        horasPorcentaje25: 0,
        horasPorcentaje50: 0,
        horasPorcentaje75: 0,
        horasPorcentaje100: 0,
        totalHorasExtras: 0,
        totalHoras: 0,
      },
    };

    for (const reg of registros) {
      // Pasamos es_hora_corrida al motor de reglas
      const segments = this.engine.calculate(reg.horaEntrada, reg.horaSalida, {
        esHoraCorrida: reg.esHoraCorrida === true,
      });

      // Detalle por día
      const detail: OvertimeDetail = {
        fecha: reg.fecha,
        segments: segments.map((seg) => ({
          inicio: dayjs(seg.inicio).format("HH:mm"),
          fin: dayjs(seg.fin).format("HH:mm"),
          tipo: seg.tipo,
          porcentaje: seg.porcentaje,
        })),
      };

      // Acumulado de horas
      for (const seg of segments) {
        const dur = dayjs(seg.fin).diff(dayjs(seg.inicio), "hour", true);
        response.conteoHoras.totalHoras += dur;

        if (seg.porcentaje === 0) {
          response.conteoHoras.horasNormal += dur;
        } else {
          response.conteoHoras.totalHorasExtras += dur;
          if (seg.porcentaje === 0.25) {
            response.conteoHoras.horasPorcentaje25 += dur;
          } else if (seg.porcentaje === 0.5) {
            response.conteoHoras.horasPorcentaje50 += dur;
          } else if (seg.porcentaje === 0.75) {
            response.conteoHoras.horasPorcentaje75 += dur;
          } else if (seg.porcentaje === 1) {
            response.conteoHoras.horasPorcentaje100 += dur;
          }
        }
      }
    }

    return response;
  }
}
