// src/domain/segmentador-tiempo.ts
import { TipoIntervalo, IntervaloTiempo, LineaTiempoDia } from "./types";
import { RegistroDiarioDetail } from "../../repositories/RegistroDiarioRepository";

/**
 * Clase encargada de segmentar la línea de tiempo del día en intervalos de 24 horas
 */
export class SegmentadorTiempo {
  /**
   * Segmenta el día en intervalos basado en el registro diario y sus actividades
   */
  static segmentarDia(registroDiario: RegistroDiarioDetail): LineaTiempoDia {
    const {
      fecha,
      empleadoId,
      horaEntrada,
      horaSalida,
      esHoraCorrida,
      actividades,
    } = registroDiario;

    // Validar que las horas normales cuadren
    this.validarHorasNormales(registroDiario);

    // Crear intervalos base
    const intervalos: IntervaloTiempo[] = [];

    // Puntos de segmentación importantes: 00:00, 05:00, 12:00, 13:00, 19:00, 24:00
    const puntosSegmentacion = [
      "00:00",
      "05:00",
      "12:00",
      "13:00",
      "19:00",
      "24:00",
    ];

    // Agregar horarios de entrada y salida a los puntos de segmentación
    const horaEntradaStr = this.dateToTimeString(horaEntrada);
    const horaSalidaStr = this.dateToTimeString(horaSalida);

    const todosPuntos = [...puntosSegmentacion, horaEntradaStr, horaSalidaStr]
      .sort()
      .filter((punto, index, arr) => arr.indexOf(punto) === index); // Eliminar duplicados

    // Crear intervalos entre puntos consecutivos
    for (let i = 0; i < todosPuntos.length - 1; i++) {
      const inicio = todosPuntos[i];
      const fin = todosPuntos[i + 1];

      if (inicio === fin) continue;

      const tipoIntervalo = this.determinarTipoIntervalo(
        inicio,
        fin,
        horaEntradaStr,
        horaSalidaStr,
        esHoraCorrida || false,
        actividades
      );

      const intervalo: IntervaloTiempo = {
        horaInicio: inicio,
        horaFin: fin,
        tipo: tipoIntervalo.tipo,
        jobId: tipoIntervalo.jobId,
        descripcion: tipoIntervalo.descripcion,
      };

      intervalos.push(intervalo);
    }

    return {
      fecha,
      empleadoId: empleadoId.toString(),
      intervalos,
    };
  }

  /**
   * Valida que las horas normales (esExtra=false) cuadren con la jornada
   */
  private static validarHorasNormales(
    registroDiario: RegistroDiarioDetail
  ): void {
    const { horaEntrada, horaSalida, esHoraCorrida, actividades } =
      registroDiario;

    const horasNormales = actividades
      .filter((act) => !act.esExtra)
      .reduce((sum, act) => sum + act.duracionHoras, 0);

    const duracionJornada =
      (horaSalida.getTime() - horaEntrada.getTime()) / 3_600_000;
    const duracionEsperada = esHoraCorrida
      ? duracionJornada
      : duracionJornada - 1;

    const tolerancia = 0.1; // 6 minutos de tolerancia

    if (Math.abs(horasNormales - duracionEsperada) > tolerancia) {
      throw new Error(
        `Las horas normales (${horasNormales}) no cuadran con la jornada esperada (${duracionEsperada})`
      );
    }
  }

  /**
   * Determina el tipo de intervalo basado en los horarios y actividades
   */
  private static determinarTipoIntervalo(
    inicio: string,
    fin: string,
    horaEntrada: string,
    horaSalida: string,
    esHoraCorrida: boolean,
    actividades: any[]
  ): { tipo: TipoIntervalo; jobId?: number; descripcion?: string } {
    // Forzar ALMUERZO a las 12 si no es hora corrida y:
    // - hay jornada que cubre 12-13; o
    // - hay actividades antes, durante o después de 12-13
    const hayJornada = horaEntrada !== horaSalida;
    let hayActividadesAlrededorAlmuerzo = false;

    if (!hayJornada && actividades.length > 0) {
      // Si no hay jornada, verificar si hay actividades alrededor del almuerzo
      for (const act of actividades) {
        if (!act.horaInicio || !act.horaFin) continue;
        const actInicio = this.dateToTimeString(act.horaInicio);
        const actFin = this.dateToTimeString(act.horaFin);

        // Verificar si la actividad está antes, durante o después del almuerzo (12:00-13:00)
        if (
          (actInicio < "13:00" && actFin > "12:00") || // Durante
          actFin <= "12:00" || // Antes
          actInicio >= "13:00"
        ) {
          // Después
          hayActividadesAlrededorAlmuerzo = true;
          break;
        }
      }
    }

    const hayHorasLaborables = hayJornada || hayActividadesAlrededorAlmuerzo;

    // Buscar actividades extras que se intersecten con este intervalo ANTES de verificar horario laboral
    // Las actividades extras tienen prioridad y pueden estar fuera del horario laboral declarado
    // Una actividad se intersecta si: actInicio < fin && actFin > inicio
    const actividadExtra = actividades.find(
      (act) => {
        if (!act.esExtra || !act.horaInicio || !act.horaFin) return false;
        const actInicio = this.dateToTimeString(act.horaInicio);
        const actFin = this.dateToTimeString(act.horaFin);
        // Verificar intersección: actInicio < fin && actFin > inicio
        return actInicio < fin && actFin > inicio;
      }
    );

    if (actividadExtra) {
      // Obtener jobId: puede venir directamente o desde job.id o job.codigo
      const jobId =
        actividadExtra.jobId ||
        (actividadExtra.job && actividadExtra.job.id) ||
        undefined;
      return {
        tipo: TipoIntervalo.EXTRA,
        jobId: jobId,
        descripcion: actividadExtra.descripcion,
      };
    }

    if (
      !esHoraCorrida &&
      hayHorasLaborables &&
      this.esHoraAlmuerzo(inicio, fin)
    ) {
      return { tipo: TipoIntervalo.ALMUERZO, descripcion: "Hora de almuerzo" };
    }

    // Verificar si está dentro del horario laboral
    const dentroHorario = this.estaEnRango(
      inicio,
      fin,
      horaEntrada,
      horaSalida
    );

    if (!dentroHorario) {
      return {
        tipo: TipoIntervalo.LIBRE,
        descripcion: "Fuera del horario laboral",
      };
    }

    // Nota: La regla de almuerzo ya fue aplicada arriba con precedencia

    // Buscar actividades normales que se intersecten con este intervalo
    const actividadNormal = actividades.find((act) => {
      if (act.esExtra) return false;
      // Si la actividad tiene horaInicio/horaFin, verificar intersección
      if (act.horaInicio && act.horaFin) {
        const actInicio = this.dateToTimeString(act.horaInicio);
        const actFin = this.dateToTimeString(act.horaFin);
        return actInicio < fin && actFin > inicio;
      }
      // Si no tiene horaInicio/horaFin, asumir que aplica a todo el horario laboral
      return true;
    });

    if (actividadNormal) {
      // Obtener jobId: puede venir directamente o desde job.id o job.codigo
      const jobId =
        actividadNormal.jobId ||
        (actividadNormal.job && actividadNormal.job.id) ||
        undefined;
      return {
        tipo: TipoIntervalo.NORMAL,
        jobId: jobId,
        descripcion: actividadNormal.descripcion,
      };
    }

    return { tipo: TipoIntervalo.LIBRE, descripcion: "Sin actividad asignada" };
  }

  /**
   * Verifica si un intervalo está dentro del rango especificado
   */
  private static estaEnRango(
    intervaloInicio: string,
    intervaloFin: string,
    rangoInicio: string,
    rangoFin: string
  ): boolean {
    return intervaloInicio >= rangoInicio && intervaloFin <= rangoFin;
  }

  /**
   * Verifica si un intervalo corresponde a la hora de almuerzo
   */
  private static esHoraAlmuerzo(inicio: string, fin: string): boolean {
    return (
      inicio >= "12:00" && fin <= "13:00" && inicio < "13:00" && fin > "12:00"
    );
  }

  /**
   * Convierte un Date a string en formato HH:mm
   */
  private static dateToTimeString(date: Date): string {
    const parts = new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
      timeZone: "America/Tegucigalpa",
    }).formatToParts(date);
    const hour = parts.find((p) => p.type === "hour")?.value ?? "00";
    const minute = parts.find((p) => p.type === "minute")?.value ?? "00";
    return `${hour}:${minute}`;
  }
}
