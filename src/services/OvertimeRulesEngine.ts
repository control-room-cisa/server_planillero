import dayjs from "dayjs";
import {
  CalculationContext,
  OvertimeRule,
  OvertimeSegment,
  TimeSegment,
} from "../dtos/OvertimeRule";

export class OvertimeRulesEngine {
  constructor(private rules: OvertimeRule[]) {
    this.rules.sort((a, b) => a.priority - b.priority);
  }

  public calculate(
    horaEntrada: Date,
    horaSalida: Date,
    extra?: Partial<CalculationContext> // NUEVO: datos extra como esHoraCorrida
  ): OvertimeSegment[] {
    const offset = horaEntrada.getTimezoneOffset();
    const start = dayjs(horaEntrada).add(offset, "minute");
    let end = dayjs(horaSalida).add(offset, "minute");

    // Si la salida es antes que la entrada, significa que terminó al día siguiente
    if (end.isBefore(start)) {
      end = end.add(1, "day");
    }

    const ctx: CalculationContext = {
      fecha: start.startOf("day"),
      acumulado: {
        horasNormal: 0,
        diurna25: 0,
        nocturna50: 0,
        mixta75: 0,
      },
      ...extra, // Inyectar esHoraCorrida aquí
    };

    const segments: TimeSegment[] = [];
    let cursor = start;
    while (cursor.isBefore(end)) {
      const next = cursor.add(1, "hour");
      segments.push({
        inicio: cursor,
        fin: next.isAfter(end) ? end : next,
      });
      cursor = next;
    }

    const resultado: OvertimeSegment[] = [];
    for (const seg of segments) {
      for (const rule of this.rules) {
        if (rule.matches(seg, ctx)) {
          const classified = rule.build(seg, ctx);
          resultado.push(classified);

          switch (classified.tipo) {
            case "normal":
              ctx.acumulado.horasNormal++;
              break;
            case "diurna25":
              ctx.acumulado.diurna25++;
              break;
            case "nocturna50":
              ctx.acumulado.nocturna50++;
              break;
            case "mixta75":
              ctx.acumulado.mixta75++;
              break;
          }
          break;
        }
      }
    }

    return resultado;
  }
}
