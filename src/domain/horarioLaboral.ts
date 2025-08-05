// domain/HorarioLaboral.ts
export type TipoHorario = "H1" | "H2";

export interface DatosDiaLaboral {
  tipoHorario: TipoHorario;
  fecha: string;
  diaSemana: number; // 0 domingo ... 6 sábado
  esFeriado: boolean;
  esDiaLibre: boolean;
  esVacacion: boolean;
}

export interface DetalleDiaLaboral {
  tipoHorario: TipoHorario;
  horasLaborales: number;
  horaInicio: string;
  horaSalida: string;
  esDiaLibre: boolean;
  esVacacion: boolean;
  incluyeAlmuerzo: boolean;
}

export class HorarioLaboral {
  static calcularDetalle(dia: DatosDiaLaboral): DetalleDiaLaboral {
    const { tipoHorario, diaSemana, esFeriado, esDiaLibre } = dia;

    switch (tipoHorario) {
      case "H1": {
        const incluyeAlmuerzo = true;
        if (diaSemana === 0 || esFeriado) {
          return {
            tipoHorario,
            horasLaborales: 0,
            horaInicio: "",
            horaSalida: "",
            esDiaLibre: true,
            esVacacion: false,
            incluyeAlmuerzo,
          };
        }

        const horaInicio = "07:00";
        const horaSalida = diaSemana === 5 ? "16:00" : "17:00"; // viernes o lunes-jueves
        const horas = diaSemana === 5 ? 8 : 9;

        return {
          tipoHorario,
          horasLaborales: horas,
          horaInicio,
          horaSalida,
          esDiaLibre: false,
          esVacacion: false,
          incluyeAlmuerzo,
        };
      }

      case "H2": {
        const incluyeAlmuerzo = false;
        if (esDiaLibre || esFeriado) {
          return {
            tipoHorario,
            horasLaborales: 0,
            horaInicio: "",
            horaSalida: "",
            esDiaLibre: true,
            esVacacion: false,
            incluyeAlmuerzo,
          };
        }

        return {
          tipoHorario,
          horasLaborales: 10,
          horaInicio: "07:00",
          horaSalida: "17:00",
          esDiaLibre: false,
          esVacacion: false,
          incluyeAlmuerzo,
        };
      }

      default:
        throw new Error(`Tipo de horario no soportado: ${tipoHorario}`);
    }
  }
}
