// src/domain/politicas-horario/H1.ts
import { PoliticaHorarioBase } from "./base";
import { ConteoHorasTrabajadas, HorarioTrabajo } from "../types";
import type { Segmento15 } from "./segmentador";

/**
 * Empleados con horario fijo de Lunes a Viernes
 * Política de horario H1 basada exclusivamente en reglas fijas:
 * - Lun–Jue: 07:00–17:00 (9h, incluye almuerzo)
 * - Vie:     07:00–16:00 (8h, incluye almuerzo)
 * - Sáb:     07:00–07:00 (0h, sin almuerzo)
 * - Dom:     07:00–07:00 (0h, sin almuerzo, día libre)
 *
 * Reglas de cómputo:
 * - NORMAL: 100%.
 * - EXTRA escalonada que no decrece dentro de la racha y se mantiene entre días;
 *   solo un intervalo LIBRE la reinicia:
 *    C1: 1.25× (extra diurna, 05:00–19:00)  → p25
 *    C2: 1.50× (extra nocturna, 19:00–05:00) → p50
 *    C3: 1.75× (“mixta”) desde que se acumulan 3h EXTRA en la racha y haya
 *        ocurrido tanto diurna como nocturna  → p75
 *    C4: 2.00× (dominical o festiva) → p100
 *        **Corrigido**: C4 también “arrastra” la categoría: contribuye a la racha
 *        y fija/eleva el piso (1.25 si fue diurna, 1.50 si nocturna) para días siguientes.
 * - NORMAL/ALMUERZO no alteran ni reinician la racha.
 * - A las 00:00, se hereda la racha desde días previos (buscando hacia atrás
 *   hasta encontrar LIBRE o agotar lookback).
 * - Los segmentos diarios ya vienen cortados en 05:00 y 19:00.
 * - Al finalizar el conteo del rango, debe cuadrar: suma de horas = 24h * días.
 
* Calculos de pagos por porcentaje:
 * Horas normales: 100% de salario por hora en cualquier caso, no se aplica acumulacion de porcentajes.
 * 1ra categoria: Horas extras diurnas: 1.25 veces el valor de la hora normal
 * 2da categoria: Horas extras nocturnas: 1.5 veces el valor de la hora normal
 * 3ra categoria: Horas mixtas: 1.75 veces el valor de la hora normal
 * 4ta categoria: Horas extras dominicales o festivas: 2 veces el valor de la hora normal
 * Horas diurnas son de las 05:00 a las 19:00
 * Se evalua el comienzo de la jornada y se comienza aplicando el porcentaje de acuerdo a la primera hora extra.
 * El porcentaje de horas extras va subiendo de acuerdo al tipo de hora extra, pero no puede disminuir en ningun caso.
 * Es decir la categoria usada va en aumento pero no puede disminuir.
 * La categoria se reinicia cuando hay espacios libres. horas normales y hora de almuerzo no afectan el acumulado de categoria.
 * Si comienza en horario nocturno y está en 1.50, no puede bajar a 1.25, debe mantenerse en 1.50 aunque las siguientes sean diurnas.
 * Si despues de horas extras hay horas normales, estas se pagan siempre al 100% de salario por hora.
 * Las horas mixtas comienzan despues del acumulado de 3 horas extras que incluyan ambas (diurnas y nocturnas).
 * Las horas extras o dominicales se aplican siempre 2 veces el valor de la hora normal sin importar si es diurna o nocturna.
 * Se debe mantener el acumulado de un dia para otro, es decir que si se comienza a las 00:00, se debe verificar el dia anterior y aplicar el acumulado con las reglas que correspondan a ese dia hasta encontrar como cierra a las 24:00 y retornar ese acumulado.
 * El acumulado se debe revisar de manera recursiva hasta que se encuentra una hora libre que corte el acumulado.
*/

export class PoliticaH1 extends PoliticaHorarioBase {
  // -------------------------- utilidades locales --------------------------
  private static HHMM_TO_MIN(hhmm: string): number {
    const [h, m] = hhmm.split(":").map(Number);
    return h * 60 + m;
  }
  private static segDurMin(seg: Segmento15): number {
    return PoliticaH1.HHMM_TO_MIN(seg.fin) - PoliticaH1.HHMM_TO_MIN(seg.inicio);
  }
  private static isDiurna(seg: Segmento15): boolean {
    const start = PoliticaH1.HHMM_TO_MIN(seg.inicio);
    return start >= 5 * 60 && start < 19 * 60; // 05:00–19:00
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
  private static daysInclusive(a: string, b: string): number {
    const [Y1, M1, D1] = a.split("-").map(Number);
    const [Y2, M2, D2] = b.split("-").map(Number);
    const d1 = Date.UTC(Y1, M1 - 1, D1);
    const d2 = Date.UTC(Y2, M2 - 1, D2);
    return Math.floor((d2 - d1) / 86400000) + 1;
  }

  // Estado de racha que cruza días
  private static nuevaRacha(): ExtraStreak {
    return {
      minutosExtraAcum: 0,
      vistoDiurna: false,
      vistoNocturna: false,
      piso: 0,
      domOFestActivo: false, // arrastre de C4 a través de medianoche
      bloquearMixta: false, // deshabilitar p75 en días no laborables
    };
  }
  private static copiarRacha(r: ExtraStreak): ExtraStreak {
    return { ...r };
  }
  private static rachaEsMixta(r: ExtraStreak): boolean {
    return r.minutosExtraAcum >= 180 && r.vistoDiurna && r.vistoNocturna; // 3h y ambas franjas
  }

  // Aplica un slot de 15 min de EXTRA a la racha y suma buckets
  private static aplicarExtraSlot(
    esDomOFest: boolean,
    esDiurna: boolean,
    r: ExtraStreak,
    b: Buckets
  ) {
    // C4: 2.00× (dominical/festiva) con arrastre entre días mientras no haya LIBRE
    const arrastraC4 = esDomOFest || r.domOFestActivo;
    if (arrastraC4) {
      b.extraC4Min += 15; // p100
      r.domOFestActivo = true; // persiste hasta que la racha termine (LIBRE)
      r.minutosExtraAcum += 15;
      if (esDiurna) r.vistoDiurna = true;
      else r.vistoNocturna = true;
      return;
    }

    // No dominical/festiva → escalera normal
    const base = esDiurna ? 1.25 : 1.5;
    if (r.piso < base) r.piso = base;

    // Mixta sólo si está habilitada para el día
    const mixtaActiva = !r.bloquearMixta && PoliticaH1.rachaEsMixta(r);
    const mult = mixtaActiva ? Math.max(1.75, r.piso) : r.piso;

    if (mult >= 1.75) b.extraC3Min += 15; // p75
    else if (mult >= 1.5) b.extraC2Min += 15; // p50
    else b.extraC1Min += 15; // p25

    r.minutosExtraAcum += 15;
    if (esDiurna) r.vistoDiurna = true;
    else r.vistoNocturna = true;
  }

  private static minutosAhoras(min: number): number {
    return Math.round((min / 60) * 100) / 100;
  }

  // -------------------------- implementación de conteo --------------------------

  async getConteoHorasTrabajajadasByDateAndEmpleado(
    fechaInicio: string,
    fechaFin: string,
    empleadoId: string
  ): Promise<ConteoHorasTrabajadas> {
    if (
      !this.validarFormatoFecha(fechaInicio) ||
      !this.validarFormatoFecha(fechaFin)
    ) {
      throw new Error("Formato de fecha inválido. Use YYYY-MM-DD");
    }
    if (fechaFin < fechaInicio)
      throw new Error("El rango de fechas es inválido (fin < inicio).");

    // Sembrar racha antes del primer día
    let racha = await this.sembrarRachaAntesDe(fechaInicio, empleadoId);

    // Buckets en minutos
    const b: Buckets = {
      normalMin: 0,
      almuerzoMin: 0,
      libreMin: 0,
      extraC1Min: 0,
      extraC2Min: 0,
      extraC3Min: 0,
      extraC4Min: 0,
      // normales por jobs especiales
      incapacidadMin: 0,
      vacacionesMin: 0,
      permisoConSueldoMin: 0,
      permisoSinSueldoMin: 0,
      compensatorioMin: 0,
    };

    // Acumuladores adicionales por jobs especiales provenientes de actividades SIN hora (normales)
    let addIncapacidadMin = 0;
    let addVacacionesMin = 0;
    let addPermisoCSMin = 0;
    let addPermisoSSMin = 0;
    let addCompensatorioMin = 0;

    // Recorrer días
    let f = fechaInicio;
    while (f <= fechaFin) {
      const { segmentos } = await this.generarSegmentosDeDiaConValidacion(
        f,
        empleadoId
      );

      // info del día
      const feriadoInfo = await this.esFeriado(f);
      const dow = new Date(`${f}T00:00:00`).getDay(); // 0=Dom
      const esDomingo = dow === 0;
      const esFestivo = feriadoInfo.esFeriado;

      // Día libre de contrato (ej. sábado)
      const hTrabajo = await this.getHorarioTrabajoByDateAndEmpleado(
        f,
        empleadoId
      );
      const esDiaLibreContrato =
        hTrabajo.esDiaLibre ||
        hTrabajo.cantidadHorasLaborables === 0 ||
        hTrabajo.horarioTrabajo.inicio === hTrabajo.horarioTrabajo.fin;

      // p100 sólo por domingo/feriado (no por día libre)
      const esDomOFest = esDomingo || esFestivo;

      // En días no laborables bloquear p75 (mixta)
      racha.bloquearMixta = esDomingo || esFestivo || esDiaLibreContrato;

      // Contadores por día (para logging)
      let normalMinDia = 0;
      let almuerzoMinDia = 0;
      let libreMinDia = 0;
      let extraMinDia = 0;
      let incapDiaSeg = 0,
        vacDiaSeg = 0,
        permCSDiaSeg = 0,
        permSSDiaSeg = 0,
        compDiaSeg = 0;

      for (const seg of segmentos) {
        const dur = PoliticaH1.segDurMin(seg);
        if (dur <= 0) continue;

        switch (seg.tipo) {
          case "LIBRE":
            b.libreMin += dur;
            libreMinDia += dur;
            racha = PoliticaH1.nuevaRacha(); // reset total (incluye domOFestActivo/bloquearMixta)
            break;

          case "ALMUERZO":
            b.almuerzoMin += dur;
            almuerzoMinDia += dur;
            // La racha se mantiene
            break;

          case "NORMAL": {
            const code = seg.jobCodigo?.toUpperCase?.();
            if (code === "E01") {
              b.incapacidadMin += dur;
              incapDiaSeg += dur;
            } else if (code === "E02") {
              b.vacacionesMin += dur;
              vacDiaSeg += dur;
            } else if (code === "E03") {
              b.permisoConSueldoMin += dur;
              permCSDiaSeg += dur;
            } else if (code === "E04") {
              b.permisoSinSueldoMin += dur;
              permSSDiaSeg += dur;
            } else if (code === "E05") {
              b.compensatorioMin += dur;
              compDiaSeg += dur;
            } else {
              b.normalMin += dur;
              normalMinDia += dur;
            }
            // La racha se mantiene
            break;
          }

          case "EXTRA": {
            const slots = dur / 15; // segmentos vienen ya cortados (05/19)
            const esDiurna = PoliticaH1.isDiurna(seg);
            for (let i = 0; i < slots; i++) {
              PoliticaH1.aplicarExtraSlot(esDomOFest, esDiurna, racha, b);
            }
            extraMinDia += dur;
            break;
          }
        }
      }

      // Sumar horas de actividades normales (sin horaInicio/horaFin) por job especial
      let addIncapDia = 0,
        addVacDia = 0,
        addPermCSDia = 0,
        addPermSSDia = 0,
        addCompDia = 0;
      try {
        const reg = await this.getRegistroDiario(empleadoId, f);
        if (reg?.actividades?.length) {
          for (const act of reg.actividades as any[]) {
            if (act?.esExtra) continue; // solo normales
            const horas = Number(act?.duracionHoras ?? 0);
            if (!isFinite(horas) || horas <= 0) continue;
            const codigo = act?.job?.codigo?.toUpperCase?.();
            if (!codigo) continue;
            const min = Math.round(horas * 60);
            if (codigo === "E01") {
              addIncapacidadMin += min;
              addIncapDia += min;
            } else if (codigo === "E02") {
              addVacacionesMin += min;
              addVacDia += min;
            } else if (codigo === "E03") {
              addPermisoCSMin += min;
              addPermCSDia += min;
            } else if (codigo === "E04") {
              addPermisoSSMin += min;
              addPermSSDia += min;
            } else if (codigo === "E05") {
              addCompensatorioMin += min;
              addCompDia += min;
            }
          }
        }
      } catch {
        /* ignore */
      }

      const especialesSegDia =
        incapDiaSeg + vacDiaSeg + permCSDiaSeg + permSSDiaSeg + compDiaSeg;
      const especialesAddDia =
        addIncapDia + addVacDia + addPermCSDia + addPermSSDia + addCompDia;
      const normalDiaAjustado = Math.max(
        0,
        normalMinDia - especialesSegDia - especialesAddDia
      );

      console.log(
        `[H1][${f}] normal=${(normalDiaAjustado / 60).toFixed(2)}h, ` +
          `almuerzo=${(almuerzoMinDia / 60).toFixed(2)}h, extra=${(
            extraMinDia / 60
          ).toFixed(2)}h, libre=${(libreMinDia / 60).toFixed(2)}h | ` +
          `E01(incap)=${((incapDiaSeg + addIncapDia) / 60).toFixed(
            2
          )}h, E02(vac)=${((vacDiaSeg + addVacDia) / 60).toFixed(
            2
          )}h, E03(permCS)=${((permCSDiaSeg + addPermCSDia) / 60).toFixed(
            2
          )}h, E04(permSS)=${((permSSDiaSeg + addPermSSDia) / 60).toFixed(
            2
          )}h, E05(comp)=${((compDiaSeg + addCompDia) / 60).toFixed(2)}h`
      );

      f = PoliticaH1.addDays(f, 1);
    }

    // Validar cuadre (en minutos): debe ser 24h * número de días
    const dias = PoliticaH1.daysInclusive(fechaInicio, fechaFin);
    const esperadoMin = dias * 24 * 60;
    const totalMin =
      b.normalMin +
      b.almuerzoMin +
      b.libreMin +
      b.extraC1Min +
      b.extraC2Min +
      b.extraC3Min +
      b.extraC4Min;

    if (totalMin !== esperadoMin) {
      throw new Error(
        `[H1] Cuadre inválido: total=${totalMin} min, esperado=${esperadoMin} min` +
          ` (dias=${dias}, rango=${fechaInicio}..${fechaFin})`
      );
    }

    // Mapear a interfaz (horas)
    const totalEspecialesAddMin =
      addIncapacidadMin +
      addVacacionesMin +
      addPermisoCSMin +
      addPermisoSSMin +
      addCompensatorioMin;

    const result: ConteoHorasTrabajadas = {
      fechaInicio,
      fechaFin,
      empleadoId,
      cantidadHoras: {
        normal: PoliticaH1.minutosAhoras(
          Math.max(0, b.normalMin - totalEspecialesAddMin)
        ),
        p25: PoliticaH1.minutosAhoras(b.extraC1Min),
        p50: PoliticaH1.minutosAhoras(b.extraC2Min),
        p75: PoliticaH1.minutosAhoras(b.extraC3Min),
        p100: PoliticaH1.minutosAhoras(b.extraC4Min),
        libre: PoliticaH1.minutosAhoras(b.libreMin),
        almuerzo: PoliticaH1.minutosAhoras(b.almuerzoMin),
        incapacidad: PoliticaH1.minutosAhoras(
          b.incapacidadMin + addIncapacidadMin
        ),
        vacaciones: PoliticaH1.minutosAhoras(
          b.vacacionesMin + addVacacionesMin
        ),
        permisoConSueldo: PoliticaH1.minutosAhoras(
          b.permisoConSueldoMin + addPermisoCSMin
        ),
        permisoSinSueldo: PoliticaH1.minutosAhoras(
          b.permisoSinSueldoMin + addPermisoSSMin
        ),
        compensatorio: PoliticaH1.minutosAhoras(
          b.compensatorioMin + addCompensatorioMin
        ),
      },
    };

    // ---------------- Conteo en días (base 15) ----------------
    const totalPeriodo = 15;
    const horasIncapacidad = PoliticaH1.minutosAhoras(b.incapacidadMin);
    const horasVacaciones = PoliticaH1.minutosAhoras(b.vacacionesMin);
    const horasPermisoCS = PoliticaH1.minutosAhoras(b.permisoConSueldoMin);
    const horasPermisoSS = PoliticaH1.minutosAhoras(b.permisoSinSueldoMin);

    const horasTope3Dias = 3 * 8; // 24 horas
    const horasIncapacidadIHSS = Math.max(0, horasIncapacidad - horasTope3Dias);
    const horasIncapacidadBase = Math.min(horasIncapacidad, horasTope3Dias);

    const diasVacaciones = horasVacaciones / 8;
    const diasPermisoCS = horasPermisoCS / 8;
    const diasPermisoSS = horasPermisoSS / 8;
    const diasIncapacidad = horasIncapacidadBase / 8;
    const diasIncapacidadIHSS = horasIncapacidadIHSS / 8;

    const diasNoLaboradosPorEspeciales =
      diasVacaciones +
      diasPermisoCS +
      diasPermisoSS +
      diasIncapacidad +
      diasIncapacidadIHSS;
    const diasLaborados = totalPeriodo - diasNoLaboradosPorEspeciales;

    result.conteoDias = {
      totalPeriodo,
      diasLaborados,
      vacaciones: diasVacaciones,
      permisoConSueldo: diasPermisoCS,
      permisoSinSueldo: diasPermisoSS,
      incapacidad: diasIncapacidad,
      incapacidadIHSS: diasIncapacidadIHSS,
    };

    return result;
  }

  /**
   * Siembra la racha al inicio del rango mirando días previos y avanzando el estado
   * hasta el día anterior. Se detiene si encuentra LIBRE; si no, hereda el estado acumulado.
   */
  private async sembrarRachaAntesDe(
    fechaInicio: string,
    empleadoId: string
  ): Promise<ExtraStreak> {
    const escalas = [7, 14, 21, 30]; // hasta 30 días hacia atrás
    for (const back of escalas) {
      const desde = PoliticaH1.addDays(fechaInicio, -back);
      const hasta = PoliticaH1.addDays(fechaInicio, -1);

      let r = PoliticaH1.nuevaRacha();
      let f = desde;
      let huboLibre = false;

      while (f <= hasta) {
        const { segmentos } = await this.generarSegmentosDeDiaConValidacion(
          f,
          empleadoId
        );
        const feriadoInfo = await this.esFeriado(f);
        const dow = new Date(`${f}T00:00:00`).getDay();
        const esDomOFest = dow === 0 || feriadoInfo.esFeriado;

        // bloquear mixta en no laborables durante la siembra
        const ht = await this.getHorarioTrabajoByDateAndEmpleado(f, empleadoId);
        const esDiaLibreContrato =
          ht.esDiaLibre ||
          ht.cantidadHorasLaborables === 0 ||
          ht.horarioTrabajo.inicio === ht.horarioTrabajo.fin;
        r.bloquearMixta = esDiaLibreContrato || esDomOFest;

        for (const seg of segmentos) {
          const dur = PoliticaH1.segDurMin(seg);
          if (dur <= 0) continue;

          if (seg.tipo === "LIBRE") {
            r = PoliticaH1.nuevaRacha();
            huboLibre = true;
            continue;
          }
          if (seg.tipo === "ALMUERZO" || seg.tipo === "NORMAL") continue;

          // EXTRA
          const slots = dur / 15;
          const esDiurna = PoliticaH1.isDiurna(seg);
          for (let i = 0; i < slots; i++) {
            PoliticaH1.aplicarExtraSlot(esDomOFest, esDiurna, r, DUMMY_BUCKETS);
          }
        }
        f = PoliticaH1.addDays(f, 1);
      }

      if (huboLibre || back === 30) return r;
    }
    return PoliticaH1.nuevaRacha();
  }

  // -------------------------- otros métodos requeridos --------------------------

  protected getHorasLaborablesBase(): number {
    return 9; // referencial
  }

  protected getHorarioEstandar(): { inicio: string; fin: string } {
    return { inicio: "07:00", fin: "17:00" }; // L–J
  }

  protected incluyeAlmuerzoDefault(): boolean {
    return true;
  }

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

    const feriadoInfo = await this.esFeriado(fecha);
    const dia = new Date(`${fecha}T00:00:00`).getDay(); // 0=Dom

    let inicio = "07:00";
    let fin = "07:00";
    let incluyeAlmuerzo = false;
    let cantidadHorasLaborables = 0;
    let esDiaLibre = false;

    if (feriadoInfo.esFeriado) {
      esDiaLibre = dia === 0;
    } else {
      switch (dia) {
        case 0:
          esDiaLibre = true; // Domingo
          break;
        case 6:
          esDiaLibre = true; // Sábado (0h)
          break;
        case 5:
          inicio = "07:00";
          fin = "16:00";
          incluyeAlmuerzo = true;
          cantidadHorasLaborables = 8;
          break;
        default:
          inicio = "07:00";
          fin = "17:00";
          incluyeAlmuerzo = true;
          cantidadHorasLaborables = 9;
          break;
      }
    }

    return {
      tipoHorario: "H1",
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
}

/* ----------------------- tipos auxiliares internos ----------------------- */

type ExtraStreak = {
  minutosExtraAcum: number; // total EXTRA desde último LIBRE
  vistoDiurna: boolean;
  vistoNocturna: boolean;
  piso: number; // 0 | 1.25 | 1.5 (no decrece)
  domOFestActivo: boolean; // arrastre de p100 entre días
  bloquearMixta: boolean; // deshabilita p75 en no laborables
};

type Buckets = {
  normalMin: number;
  almuerzoMin: number;
  libreMin: number;
  extraC1Min: number; // p25
  extraC2Min: number; // p50
  extraC3Min: number; // p75
  extraC4Min: number; // p100
  // normales por jobs especiales (minutos)
  incapacidadMin: number; // E01
  vacacionesMin: number; // E02
  permisoConSueldoMin: number; // E03
  permisoSinSueldoMin: number; // E04
  compensatorioMin: number; // E05
};

const DUMMY_BUCKETS: Buckets = {
  normalMin: 0,
  almuerzoMin: 0,
  libreMin: 0,
  extraC1Min: 0,
  extraC2Min: 0,
  extraC3Min: 0,
  extraC4Min: 0,
  incapacidadMin: 0,
  vacacionesMin: 0,
  permisoConSueldoMin: 0,
  permisoSinSueldoMin: 0,
  compensatorioMin: 0,
};
