// src/domain/politicas-horario/H2.ts
import { PoliticaHorarioBase } from "./base";
import type {
  HorarioTrabajo,
  ConteoHorasTrabajadas,
  ConteoHorasProrrateo,
  HorasPorJob,
} from "../types";
import { JobRepository } from "../../../repositories/JobRepository";
import { SegmentadorTiempo } from "../segmentador-tiempo";

/**
 * Política H2 — Turnos rotativos de 12h, sin almuerzo.
 *
 * Reglas:
 * - Entrada/Salida: mismo formato de retorno que H1; H2 SIEMPRE ignora almuerzo.
 * - Feriado o día libre: NORMAL = 0; todo lo trabajado es EXTRA al 25% (p25). Sin excepciones.
 * - Turno diurno: 12 h normales por día (lo normal).
 * - Turno nocturno:
 *      * Martes: 6 h normales (cambio de turno).
 *      * Otros días: normales según intervalo declarado (típicamente 12 h).
 * - Las horas NORMALES deben coincidir con el intervalo Entrada/Salida del día,
 *   excepto la regla especial del martes nocturno (6 h).
 * - H2 NO usa p50/p75/p100 ni almuerzo (si aparece ALMUERZO → ERROR).
 * - Validación global: suma de horas por día = 24 h; en el rango = 24 h * #días.
 */
export class PoliticaH2 extends PoliticaHorarioBase {
  // --------------------- utilidades locales mínimas ---------------------
  private static hhmmToMin(hhmm: string): number {
    const [h, m] = hhmm.split(":").map(Number);
    return h * 60 + m;
  }
  private static minutesOfDayInTZ(d: Date, tz = "America/Tegucigalpa"): number {
    const parts = new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
      timeZone: tz,
    }).formatToParts(d);
    const hh = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
    const mm = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
    return hh * 60 + mm;
  }
  private static addDays(iso: string, d: number): string {
    const [Y, M, D] = iso.split("-").map(Number);
    const dt = new Date(Date.UTC(Y, M - 1, D));
    dt.setUTCDate(dt.getUTCDate() + d);
    const y = dt.getUTCFullYear();
    const m = `${dt.getUTCMonth() + 1}`.padStart(2, "0");
    const day = `${dt.getUTCDate()}`.padStart(2, "0");
    return `${y}-${m}-${day}`;
  }
  private static dayCountInclusive(a: string, b: string): number {
    const [Y1, M1, D1] = a.split("-").map(Number);
    const [Y2, M2, D2] = b.split("-").map(Number);
    const d1 = Date.UTC(Y1, M1 - 1, D1);
    const d2 = Date.UTC(Y2, M2 - 1, D2);
    return Math.floor((d2 - d1) / 86400000) + 1;
  }
  /** Minutos declarados como NORMAL por Entrada/Salida (sin almuerzo). */
  private static normalesDeclaradosMin(e: Date, s: Date): number {
    const em = this.minutesOfDayInTZ(e);
    const sm = this.minutesOfDayInTZ(s);
    if (em === sm) return 0;
    if (em < sm) return sm - em;
    return sm + (24 * 60 - em); // cruza medianoche
  }
  /** Nocturno para la regla del martes (sin cortes 05/19: solo 19–07). */
  private static esNocturno(e: Date, s: Date): boolean {
    const em = this.minutesOfDayInTZ(e);
    const sm = this.minutesOfDayInTZ(s);
    if (em > sm) return true; // típico 19–07 (parte en 2 días)
    const enNocheA = em >= 19 * 60; // 19–24
    const enNocheB = sm <= 7 * 60; // 00–07
    return enNocheA || enNocheB;
  }

  // --------------------- plan diario (misma interfaz que H1) ---------------------
  async getHorarioTrabajoByDateAndEmpleado(
    fecha: string,
    empleadoId: string
  ): Promise<HorarioTrabajo> {
    if (!this.validarFormatoFecha(fecha)) {
      throw new Error("Formato de fecha inválido. Use YYYY-MM-DD");
    }
    const empleado = await this.getEmpleado(empleadoId);
    if (!empleado)
      throw new Error(`Empleado con ID ${empleadoId} no encontrado`);

    const reg = await this.getRegistroDiario(empleadoId, fecha);
    const feriadoInfo = await this.esFeriado(fecha);
    const esDiaLibre = reg?.esDiaLibre || false;

    let inicio = "07:00";
    let fin = "19:00";
    let cantidadHorasLaborables = 12;
    const incluyeAlmuerzo = false; // H2 jamás almuerzo

    if (reg) {
      const e = new Date(reg.horaEntrada);
      const s = new Date(reg.horaSalida);
      const toHHMM = (d: Date) => d.toTimeString().slice(0, 5);
      inicio = toHHMM(e);
      fin = toHHMM(s);
      cantidadHorasLaborables = PoliticaH2.normalesDeclaradosMin(e, s) / 60;
    }

    return {
      tipoHorario: "H2",
      fecha,
      empleadoId,
      horarioTrabajo: { inicio, fin },
      incluyeAlmuerzo,
      esDiaLibre,
      esFestivo: feriadoInfo.esFeriado,
      nombreDiaFestivo: feriadoInfo.nombre,
      cantidadHorasLaborables,
    };
  }

  // --------------------- conteo por rango (simple) ---------------------
  async getConteoHorasTrabajajadasByDateAndEmpleado(
    fechaInicio: string,
    fechaFin: string,
    empleadoId: string
  ): Promise<
    ConteoHorasTrabajadas & {
      tiposDias: Array<{
        fecha: string;
        tipo: "diurno" | "nocturno" | "libre" | "festivo";
      }>;
    }
  > {
    if (
      !this.validarFormatoFecha(fechaInicio) ||
      !this.validarFormatoFecha(fechaFin)
    ) {
      throw new Error("Formato de fecha inválido. Use YYYY-MM-DD");
    }
    if (fechaFin < fechaInicio)
      throw new Error("El rango de fechas es inválido (fin < inicio).");

    // acumuladores en minutos
    let normalMin = 0;
    let p25Min = 0;
    let libreMin = 0;
    // H2 no usa estos:
    const p50Min = 0,
      p75Min = 0,
      p100Min = 0,
      almuerzoMin = 0;

    const tiposDias: Array<{
      fecha: string;
      tipo: "diurno" | "nocturno" | "libre" | "festivo";
    }> = [];
    const errores: Array<{ fecha: string; motivo: string; detalle?: any }> = [];

    // recorrer días
    let f = fechaInicio;
    while (f <= fechaFin) {
      const { segmentos, errores: segErrs } =
        await this.generarSegmentosDeDiaConValidacion(f, empleadoId);
      if (segErrs?.length)
        errores.push({ fecha: f, motivo: "segmentador", detalle: segErrs });

      const reg = await this.getRegistroDiario(empleadoId, f);
      const feriadoInfo = await this.esFeriado(f);
      const esFestivo = feriadoInfo.esFeriado;
      const esLibre = reg?.esDiaLibre ?? false;

      // Tipo de día
      let tipoDia: "diurno" | "nocturno" | "libre" | "festivo";
      if (esFestivo) tipoDia = "festivo";
      else if (esLibre || !reg) tipoDia = "libre";
      else {
        const e = new Date(reg.horaEntrada);
        const s = new Date(reg.horaSalida);
        tipoDia = PoliticaH2.esNocturno(e, s) ? "nocturno" : "diurno";
      }
      tiposDias.push({ fecha: f, tipo: tipoDia });

      // Sumar por tipo de segmento (H2: ALMUERZO NO se acepta → error si aparece)
      let normalMinDia = 0;
      let extraMinDia = 0;
      let libreMinDia = 0;
      let almuerzoMinDia = 0;

      for (const seg of segmentos) {
        const a = PoliticaH2.hhmmToMin(seg.inicio);
        const b = PoliticaH2.hhmmToMin(seg.fin);
        const dur = Math.max(0, b - a);
        if (dur === 0) continue;

        switch (seg.tipo) {
          case "LIBRE":
            libreMinDia += dur;
            break;
          case "EXTRA":
            extraMinDia += dur;
            break;
          case "ALMUERZO":
            almuerzoMinDia += dur;
            break; // PROHIBIDO en H2
          case "NORMAL":
            normalMinDia += dur;
            break;
        }
      }

      const dow = new Date(`${f}T00:00:00`).getDay(); // 0=Dom, 2=Mar
      let esperadaNormalMin = 0;

      if (esFestivo || esLibre || !reg) {
        // Feriado/Libre: NORMAL debe ser 0; todo lo demás es EXTRA
        esperadaNormalMin = 0;
        if (normalMinDia > 0) {
          errores.push({
            fecha: f,
            motivo: "FERIADO_O_LIBRE_CON_NORMAL",
            detalle: { normalMinDia },
          });
        }
        if (almuerzoMinDia > 0) {
          errores.push({
            fecha: f,
            motivo: "ALMUERZO_NO_PERMITIDO_EN_H2",
            detalle: { almuerzoMinDia },
          });
        }
      } else {
        const e = new Date(reg.horaEntrada);
        const s = new Date(reg.horaSalida);
        const nocturno = PoliticaH2.esNocturno(e, s);

        // Esperado por día (sin almuerzo)
        if (nocturno && dow === 2) {
          // martes
          esperadaNormalMin = 6 * 60;
        } else {
          esperadaNormalMin = PoliticaH2.normalesDeclaradosMin(e, s);
        }

        // 1) Almuerzo jamás permitido en H2 (y tu regla específica pide error si aparece en horas normales)
        if (almuerzoMinDia > 0) {
          errores.push({
            fecha: f,
            motivo: "ALMUERZO_NO_PERMITIDO_EN_H2",
            detalle: { almuerzoMinDia },
          });
        }

        // 2) NORMAL debe coincidir exactamente con lo esperado (sin considerar almuerzo)
        if (normalMinDia !== esperadaNormalMin) {
          errores.push({
            fecha: f,
            motivo: "NORMAL_NO_COINCIDE_CON_INTERVALO",
            detalle: {
              normalMinDia,
              esperadaNormalMin,
              entrada: e.toTimeString().slice(0, 5),
              salida: s.toTimeString().slice(0, 5),
              nocturno,
              esMartes: dow === 2,
            },
          });
        }
      }

      // Acumular totales
      normalMin += normalMinDia;
      p25Min += extraMinDia; // todas extras a p25
      libreMin += libreMinDia;

      f = PoliticaH2.addDays(f, 1);
    }

    // Cuadre global (24 h por día)
    const dias = PoliticaH2.dayCountInclusive(fechaInicio, fechaFin);
    const esperadoGlobalMin = dias * 24 * 60;
    const totalMin =
      normalMin + p25Min + libreMin; /* + p50+p75+p100(0) + almuerzo(0) */

    if (totalMin !== esperadoGlobalMin) {
      errores.push({
        fecha: `${fechaInicio}..${fechaFin}`,
        motivo: "CUADRE_GLOBAL_INVALIDO",
        detalle: { totalMin, esperadoGlobalMin, dias },
      });
    }

    // Lanzar si hay cualquier error (incluye almuerzo no permitido)
    if (errores.length > 0) {
      throw new Error(
        `[H2] Validaciones fallidas: ${JSON.stringify(errores, null, 2)}`
      );
    }

    // Respuesta (horas a 2 decimales)
    const toHours = (m: number) => Math.round((m / 60) * 100) / 100;
    const conteo: ConteoHorasTrabajadas = {
      fechaInicio,
      fechaFin,
      empleadoId,
      cantidadHoras: {
        normal: toHours(normalMin),
        p25: toHours(p25Min),
        p50: 0,
        p75: 0,
        p100: 0,
        libre: toHours(libreMin),
        almuerzo: 0,
      },
    };

    // ---------------- Conteo en días (base 15) ----------------
    const totalPeriodo = 15;
    const horasVacaciones = 0;
    const horasPermisoCS = 0;
    const horasPermisoSS = 0;
    const horasInasistencias = 0;

    const diasVacaciones = horasVacaciones / 8;
    const diasPermisoCS = horasPermisoCS / 8;
    const diasPermisoSS = horasPermisoSS / 8;
    const diasInasistencias = horasInasistencias / 8;

    const diasNoLaborados =
      diasVacaciones + diasPermisoCS + diasPermisoSS + diasInasistencias;
    const diasLaborados = totalPeriodo - diasNoLaborados;

    conteo.conteoDias = {
      totalPeriodo,
      diasLaborados,
      vacaciones: diasVacaciones,
      permisoConSueldo: diasPermisoCS,
      permisoSinSueldo: diasPermisoSS,
      inasistencias: diasInasistencias,
    };

    return Object.assign(conteo, { tiposDias });
  }

  // --------------------- overrides abstract mínimos ---------------------
  protected getHorasLaborablesBase(): number {
    return 12;
  }
  protected getHorarioEstandar(): { inicio: string; fin: string } {
    return { inicio: "07:00", fin: "19:00" };
  }
  protected incluyeAlmuerzoDefault(): boolean {
    return false;
  }

  /**
   * Obtiene el prorrateo de horas por job para un empleado en un período
   */
  async getProrrateoHorasPorJobByDateAndEmpleado(
    fechaInicio: string,
    fechaFin: string,
    empleadoId: string
  ): Promise<ConteoHorasProrrateo> {
    if (
      !this.validarFormatoFecha(fechaInicio) ||
      !this.validarFormatoFecha(fechaFin)
    ) {
      throw new Error("Formato de fecha inválido. Use YYYY-MM-DD");
    }
    if (fechaFin < fechaInicio)
      throw new Error("El rango de fechas es inválido (fin < inicio).");

    // Obtener conteo de horas trabajadas
    const conteoHoras = await this.getConteoHorasTrabajadasByDateAndEmpleado(
      fechaInicio,
      fechaFin,
      empleadoId
    );

    // Mapas para acumular horas por job y categoría
    const horasPorJobNormal = new Map<
      number,
      { jobId: number; codigoJob: string; nombreJob: string; horas: number }
    >();
    const horasPorJobP25 = new Map<
      number,
      { jobId: number; codigoJob: string; nombreJob: string; horas: number }
    >();

    // Recorrer cada día del período y obtener los segmentos
    let currentDate = fechaInicio;
    while (currentDate <= fechaFin) {
      try {
        // Obtener registro diario con actividades
        const registroDiario = await this.getRegistroDiario(
          empleadoId,
          currentDate
        );

        if (!registroDiario) {
          currentDate = PoliticaH2.addDays(currentDate, 1);
          continue;
        }

        // Segmentar el día usando el registro diario
        const lineaTiempo = SegmentadorTiempo.segmentarDia(registroDiario);

        // Procesar cada intervalo del día
        for (const intervalo of lineaTiempo.intervalos) {
          // Solo procesar intervalos que tienen jobId (NORMAL y EXTRA)
          if (!intervalo.jobId) continue;

          // Calcular duración del intervalo en horas
          const [horaInicio, minInicio] = intervalo.horaInicio
            .split(":")
            .map(Number);
          const [horaFin, minFin] = intervalo.horaFin.split(":").map(Number);
          const minutosInicio = horaInicio * 60 + minInicio;
          const minutosFin = horaFin * 60 + minFin;
          const duracionHoras = (minutosFin - minutosInicio) / 60;

          // Obtener información del job
          const job = await JobRepository.findById(intervalo.jobId);
          if (!job) continue;

          const jobInfo = {
            jobId: job.id,
            codigoJob: job.codigo || "",
            nombreJob: job.nombre || "",
            horas: 0,
          };

          // Clasificar el intervalo según el tipo
          // H2 solo usa normal y p25 (extras al 25%)
          if (intervalo.tipo === "NORMAL") {
            const existing = horasPorJobNormal.get(job.id);
            if (existing) {
              existing.horas += duracionHoras;
            } else {
              horasPorJobNormal.set(job.id, {
                ...jobInfo,
                horas: duracionHoras,
              });
            }
          } else if (intervalo.tipo === "EXTRA") {
            // En H2, todas las extras son p25
            const existing = horasPorJobP25.get(job.id);
            if (existing) {
              existing.horas += duracionHoras;
            } else {
              horasPorJobP25.set(job.id, {
                ...jobInfo,
                horas: duracionHoras,
              });
            }
          }
        }
      } catch (error) {
        console.error(`Error procesando día ${currentDate}:`, error);
      }

      // Avanzar al siguiente día
      currentDate = PoliticaH2.addDays(currentDate, 1);
    }

    // Convertir mapas a arrays
    const convertMapToArray = (
      map: Map<
        number,
        { jobId: number; codigoJob: string; nombreJob: string; horas: number }
      >
    ): HorasPorJob[] => {
      return Array.from(map.values()).map((item) => ({
        jobId: item.jobId,
        codigoJob: item.codigoJob,
        nombreJob: item.nombreJob,
        cantidadHoras: Math.round(item.horas * 100) / 100,
      }));
    };

    // Construir resultado
    const resultado: ConteoHorasProrrateo = {
      fechaInicio,
      fechaFin,
      empleadoId,
      cantidadHoras: {
        normal: convertMapToArray(horasPorJobNormal),
        p25: convertMapToArray(horasPorJobP25),
        p50: [], // H2 no usa p50
        p75: [], // H2 no usa p75
        p100: [], // H2 no usa p100
        vacacionesHoras: conteoHoras.cantidadHoras.vacaciones || 0,
        permisoConSueldoHoras: conteoHoras.cantidadHoras.permisoConSueldo || 0,
        permisoSinSueldoHoras: conteoHoras.cantidadHoras.permisoSinSueldo || 0,
        inasistenciasHoras: conteoHoras.cantidadHoras.inasistencias || 0,
        totalHorasLaborables: conteoHoras.cantidadHoras.normal || 0,
        deduccionesISR: 0,
        deduccionesRAP: 0,
        deduccionesComida: 0,
        deduccionesIHSS: 0,
        Prestamo: 0,
        Total: 0,
      },
      validationErrors: {
        fechasNoAprobadas: [],
        fechasSinRegistro: [],
      },
    };

    return resultado;
  }
}
