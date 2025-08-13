// ============================================================================
// dominio/politicas/base.ts
// Motor con: 1) jornada única + almuerzo, 2) timeline 24h segmentado,
// 3) clasificación a normal/25/50/75/100.
// ============================================================================
import {
  FechaISO,
  FechaHoraISO,
  HorarioDelDia,
  JornadaUnica,
  OpcionesConteo,
  ResultadoConteo,
  IntervaloDetallado,
  TipoActividad,
  PeriodoDia,
} from "./types";
import {
  d,
  unirFechaHoraLocal,
  intervaloDia,
  listarFechas,
  interseccion,
  minutos,
  restar,
  segmentosDiurnoNocturno,
  horasDesdeMin,
  TZ_DEF,
} from "./tiempo";
import { IPoliticaHorario } from "./interfaces";

export abstract class PoliticaBaseHorario implements IPoliticaHorario {
  protected tz = TZ_DEF;

  /** Define: libre/festivo + jornada única (inicio/fin + almuerzo opcional) */
  protected abstract jornadaDelDia(
    fecha: FechaISO,
    opciones?: OpcionesConteo
  ): Promise<{
    esDiaLibre: boolean;
    esFestivo: boolean;
    jornada?: JornadaUnica;
  }>;

  async obtenerHorario(
    fecha: FechaISO,
    opciones?: OpcionesConteo
  ): Promise<HorarioDelDia> {
    const tz = opciones?.tz ?? this.tz;
    const festivos = opciones?.festivos ?? new Set<FechaISO>();
    const base = await this.jornadaDelDia(fecha, opciones);
    const esFestivo = base.esFestivo || festivos.has(fecha);

    let horas = 0;
    if (base.jornada && !base.esDiaLibre && !esFestivo) {
      const i = d(unirFechaHoraLocal(fecha, base.jornada.inicio, tz));
      let f = d(unirFechaHoraLocal(fecha, base.jornada.fin, tz));
      const finDia = d(unirFechaHoraLocal(fecha, "00:00", tz)).add(1, "day");
      if (f.isBefore(i)) f = finDia; // recortar a fin de día
      let min = f.diff(i, "minute");

      if (base.jornada.almuerzo) {
        const a = {
          inicio: unirFechaHoraLocal(fecha, base.jornada.almuerzo.inicio, tz),
          fin: unirFechaHoraLocal(fecha, base.jornada.almuerzo.fin, tz),
        };
        const x = interseccion({ inicio: i.format(), fin: f.format() }, a);
        if (x) min -= minutos(x);
      }
      horas = horasDesdeMin(Math.max(0, min));
    }

    return {
      fecha,
      esDiaLibre: base.esDiaLibre,
      esFestivo,
      jornada: base.jornada,
      cantidadHorasLaborables: horas,
    };
  }

  async contarHoras(
    fechaInicio: FechaHoraISO,
    fechaFin: FechaHoraISO,
    opciones?: OpcionesConteo
  ): Promise<ResultadoConteo> {
    const tz = opciones?.tz ?? this.tz;
    const escalones = opciones?.escalonesExtras ?? {
      tramo25min: 120,
      tramo50min: 120,
    }; // 2h + 2h

    const ini = d(fechaInicio, tz);
    const fin = d(fechaFin, tz);
    if (!fin.isAfter(ini)) {
      return {
        fechaInicio,
        fechaFin,
        cantidadHoras: { normal: 0, p25: 0, p50: 0, p75: 0, p100: 0 },
      };
    }
    const periodo = { inicio: ini.format(), fin: fin.format() };
    const fechas = listarFechas(periodo.inicio, periodo.fin, tz);

    let normalMin = 0,
      p25Min = 0,
      p50Min = 0,
      p75Min = 0,
      p100Min = 0;
    const detalle: IntervaloDetallado[] = [];

    for (const fecha of fechas) {
      const hoy = intervaloDia(fecha, tz);
      const trabajadoDia = interseccion(periodo, hoy);
      if (!trabajadoDia) continue;

      // 1) Obtener contexto del día
      const h = await this.obtenerHorario(fecha, opciones);
      const esLibreOFestivo = h.esDiaLibre || h.esFestivo;

      // 2) Construir línea base 24h "libre"
      let timeline: {
        inicio: string;
        fin: string;
        actividad: TipoActividad;
      }[] = [{ ...hoy, actividad: "libre" }];

      // 3) Insertar trabajo del día (recorta vs "libre")
      if (trabajadoDia)
        timeline = insertarActividad(timeline, trabajadoDia, "trabajo");

      // 4) Insertar almuerzo (si hay jornada) – recorta contra lo que haya
      if (h.jornada?.almuerzo) {
        const alm = {
          inicio: unirFechaHoraLocal(fecha, h.jornada.almuerzo.inicio, tz),
          fin: unirFechaHoraLocal(fecha, h.jornada.almuerzo.fin, tz),
        };
        timeline = insertarActividad(timeline, alm, "almuerzo");
      }

      // 5) Recortar por diurno/nocturno (05–19)
      const segs = segmentosDiurnoNocturno(fecha, tz);
      timeline = recortarPorSegmentos(timeline, segs);

      // 6) Marcar enJornada para "trabajo" (solo la porción dentro de jornada del día)
      let jornadaHoy: { inicio: string; fin: string } | undefined;
      if (h.jornada) {
        const jIni = unirFechaHoraLocal(fecha, h.jornada.inicio, tz);
        let jFin = unirFechaHoraLocal(fecha, h.jornada.fin, tz);
        if (d(jFin).isBefore(d(jIni)))
          jFin = d(jIni).startOf("day").add(1, "day").format(); // hasta 24:00
        jornadaHoy =
          interseccion(hoy, { inicio: jIni, fin: jFin }) ?? undefined;
      }

      // 7) Clasificar y acumular
      let dentroMin = 0;
      let fueraMin = 0;

      for (const seg of timeline) {
        const m = minutos(seg);
        if (m === 0) continue;

        // Generar registro detallado con periodo y banderas
        const periodoDia: PeriodoDia = esSegmentoDiurno(seg, fecha, tz)
          ? "diurno"
          : "nocturno";
        const regDet: IntervaloDetallado = {
          inicio: seg.inicio,
          fin: seg.fin,
          horas: horasDesdeMin(m),
          periodo: periodoDia,
          actividad: seg.actividad,
          enJornada: false,
          esFestivo: h.esFestivo,
          esDiaLibre: h.esDiaLibre,
        };

        if (seg.actividad !== "trabajo") {
          // almuerzo/libre no suman a pago, pero quedan en el detalle
          detalle.push(regDet);
          continue;
        }

        if (esLibreOFestivo) {
          // Todo trabajo en festivo/libre => 100%
          p100Min += m;
          detalle.push(regDet);
          continue;
        }

        // Día laborable:
        let esEnJornada = false;
        if (jornadaHoy) {
          const x = interseccion(seg, jornadaHoy);
          if (x && minutos(x) > 0) {
            esEnJornada = true;
            const mm = minutos(x);
            dentroMin += mm; // normal
            // Por si el segmento de trabajo cruza fuera de jornada, dividir virtualmente:
            const fueraPartes = restar(seg, x);
            // Normal (x)
            detalle.push({
              ...regDet,
              horas: horasDesdeMin(mm),
              enJornada: true,
            });
            // Lo que queda fuera (si existe)
            for (const fp of fueraPartes) {
              const mmOut = minutos(fp);
              if (mmOut > 0) {
                fueraMin += mmOut;
                detalle.push({
                  ...regDet,
                  inicio: fp.inicio,
                  fin: fp.fin,
                  horas: horasDesdeMin(mmOut),
                  enJornada: false,
                });
              }
            }
            continue; // ya procesado
          }
        }

        // Enteramente fuera de jornada:
        fueraMin += m;
        detalle.push(regDet);
      }

      // Acumular normales:
      normalMin += dentroMin;

      // Reparto escalonado de extras del día (25% -> 50% -> 75%)
      if (!esLibreOFestivo && fueraMin > 0) {
        const m25 = Math.min(fueraMin, escalones.tramo25min);
        const m50 = Math.min(Math.max(0, fueraMin - m25), escalones.tramo50min);
        const m75 = Math.max(0, fueraMin - m25 - m50);
        p25Min += m25;
        p50Min += m50;
        p75Min += m75;
      }
    }

    const resultado: ResultadoConteo = {
      fechaInicio,
      fechaFin,
      cantidadHoras: {
        normal: horasDesdeMin(normalMin),
        p25: horasDesdeMin(p25Min),
        p50: horasDesdeMin(p50Min),
        p75: horasDesdeMin(p75Min),
        p100: horasDesdeMin(p100Min),
      },
    };
    if (opciones?.incluirDetalle) resultado.detalle = detalle;
    return resultado;
  }
}

/** Inserta una actividad recortando el arreglo base (divide y reemplaza) */
function insertarActividad(
  base: { inicio: string; fin: string; actividad: TipoActividad }[],
  nuevo: { inicio: string; fin: string },
  actividad: TipoActividad
) {
  const out: { inicio: string; fin: string; actividad: TipoActividad }[] = [];
  for (const b of base) {
    const x = interseccion(b, nuevo);
    if (!x) {
      out.push(b);
      continue;
    }
    // Partes de b - x
    const partes = restar(b, x);
    // Mantener partes que no intersectan
    for (const p of partes) out.push({ ...p, actividad: b.actividad });
    // Insertar la intersección como nueva actividad
    out.push({ inicio: x.inicio, fin: x.fin, actividad });
  }
  // Ordenar por inicio (por si acaso)
  return out.sort((a, b) => d(a.inicio).valueOf() - d(b.inicio).valueOf());
}

/** Parte la línea de tiempo en los límites diurno/nocturno de ese día */
function recortarPorSegmentos(
  base: { inicio: string; fin: string; actividad: TipoActividad }[],
  segmentos: { inicio: string; fin: string }[]
) {
  let out = base.slice();
  for (const s of segmentos) {
    const temp: typeof out = [];
    for (const b of out) {
      const x = interseccion(b, s);
      if (!x) {
        temp.push(b);
        continue;
      }

      for (const p of restar(b, x)) {
        temp.push({ inicio: p.inicio, fin: p.fin, actividad: b.actividad });
      }
      temp.push({ inicio: x.inicio, fin: x.fin, actividad: b.actividad });
    }
    out = temp.sort((a, b) => d(a.inicio).valueOf() - d(b.inicio).valueOf());
  }
  return out;
}

function esSegmentoDiurno(
  seg: { inicio: string; fin: string },
  fecha: string,
  tz = TZ_DEF
): boolean {
  const [N1, D1, N2] = segmentosDiurnoNocturno(fecha, tz);
  return !!interseccion(seg, D1);
}
