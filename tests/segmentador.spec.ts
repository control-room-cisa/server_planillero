import { describe, it, expect } from "vitest";
import { segmentarRegistroDiario } from "../src/domain/calculo-horas/politicas-horario/segmentador";

function makeDate(fecha: string, hhmm: string): Date {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date(`${fecha}T00:00:00.000Z`);
  d.setUTCHours(h, m, 0, 0);
  return d;
}

describe("segmentador - casos base", () => {
  it("Caso 1: 9h normales (7-17 con almuerzo dentro); extra 17-23", () => {
    const fecha = "2025-09-15"; // Lunes

    const registro = {
      fecha,
      horaEntrada: makeDate(fecha, "13:00"), // 07:00 local → 13:00Z
      horaSalida: makeDate(fecha, "23:00"), // 17:00 local → 23:00Z
      esHoraCorrida: false,
      esDiaLibre: false,
      actividades: [
        // Actividades normales no requieren hora (solo informativas para segmentador)
        // Las extras sí tienen horas:
        {
          horaInicio: makeDate(fecha, "23:00"), // 17:00 local → 23:00Z
          horaFin: makeDate("2025-09-16", "05:00"), // 23:00-05:00Z (cruza medianoche); 17:00-23:00 local
          esExtra: true,
          descripcion: "Extra 17-23",
          jobId: 1,
        },
      ],
    } as any;

    const { totales } = segmentarRegistroDiario(registro);
    // Rango normal: 07:00-17:00 local → 10h; con almuerzo dentro (12-13), quedan 9h normales
    expect(totales.minutosRangoNormal / 60).toBe(10);
    expect(totales.minutosAlmuerzo / 60).toBe(1);
    expect(totales.minutosNormal / 60).toBe(9);

    // Extra 17-23 local = 6h extra → 4h diurna (17-19) y 2h nocturna (19-23)
    // El segmentador no separa por categorías p25/p50/p75/p100; eso lo hace la política H1.
    expect(totales.minutosExtra / 60).toBe(6);
  });
});
