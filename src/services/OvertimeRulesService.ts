import {
  CalculationContext,
  OvertimeRule,
  TimeSegment,
  OvertimeSegment
} from '../dtos/OvertimeRule';

/**
 * 0) Domingo100: cualquier hora, recargo 100% (domingo)
 *    Si esHoraCorrida = false, se excluye la hora de almuerzo (12:00–13:00).
 */
export class Domingo100Rule implements OvertimeRule {
  priority = 5;
  matches({ inicio }: TimeSegment, ctx: CalculationContext): boolean {
    const h = inicio.hour();
    const wd = inicio.day();

    if (wd !== 0) return false; // solo domingo
    // Si NO es hora corrida, excluir hora de almuerzo
    if (!ctx.esHoraCorrida && h === 12) return false;

    return true;
  }
  build(seg: TimeSegment): OvertimeSegment {
    return {
      inicio: seg.inicio.toDate(),
      fin: seg.fin.toDate(),
      tipo: 'domingo100',
      porcentaje: 1
    };
  }
}

/**
 * 1) Sabado25: cualquier hora, recargo 25% (sábado)
 *    Si esHoraCorrida = false, se excluye la hora de almuerzo (12:00–13:00).
 */
export class Sabado25Rule implements OvertimeRule {
  priority = 10;
  matches({ inicio }: TimeSegment, ctx: CalculationContext): boolean {
    const h = inicio.hour();
    const wd = inicio.day();

    if (wd !== 6) return false; // solo sábado
    // Si NO es hora corrida, excluir hora de almuerzo
    if (!ctx.esHoraCorrida && h === 12) return false;

    return true;
  }
  build(seg: TimeSegment): OvertimeSegment {
    return {
      inicio: seg.inicio.toDate(),
      fin: seg.fin.toDate(),
      tipo: 'sabado25',
      porcentaje: 0.25
    };
  }
}

/**
 * 2) Normal (diurna): 05:00–19:00, hasta 9h sin recargo (excluye 12:00–13:00 si no es hora corrida)
 */
export class NormalRule implements OvertimeRule {
  priority = 20;
  matches({ inicio }: TimeSegment, ctx: CalculationContext): boolean {
    const h = inicio.hour();
    const wd = inicio.day();
    if (wd === 0 || wd === 6) return false; // excluye domingos y sábados
    if (h < 5 || h >= 19) return false;     // fuera de diurna

    // Excluir almuerzo solo si NO es hora corrida
    if (!ctx.esHoraCorrida && h === 12) return false;

    if (ctx.acumulado.horasNormal >= 9) return false; // solo 9h normales
    return true;
  }
  build(seg: TimeSegment): OvertimeSegment {
    return {
      inicio: seg.inicio.toDate(),
      fin: seg.fin.toDate(),
      tipo: 'normal',
      porcentaje: 0
    };
  }
}

/**
 * 3) Diurna25: diurna (05:00–19:00) después de 9h normales → 25%
 */
export class Diurna25Rule implements OvertimeRule {
  priority = 30;
  matches({ inicio }: TimeSegment, ctx: CalculationContext): boolean {
    const h = inicio.hour();
    const wd = inicio.day();
    if (wd === 0 || wd === 6) return false; // excluye fin de semana
    if (h < 5 || h >= 19) return false;     // fuera de diurna
    if (ctx.acumulado.horasNormal < 9) return false; // solo tras 9h normales
    return true;
  }
  build(seg: TimeSegment): OvertimeSegment {
    return {
      inicio: seg.inicio.toDate(),
      fin: seg.fin.toDate(),
      tipo: 'diurna25',
      porcentaje: 0.25
    };
  }
}

/**
 * 4) Mixta75: tras 3h nocturnas al 50% → 75%
 */
export class Mixta75Rule implements OvertimeRule {
  priority = 40;
  matches(_: TimeSegment, ctx: CalculationContext): boolean {
    return ctx.acumulado.nocturna50 >= 3;
  }
  build(seg: TimeSegment): OvertimeSegment {
    return {
      inicio: seg.inicio.toDate(),
      fin: seg.fin.toDate(),
      tipo: 'mixta75',
      porcentaje: 0.75
    };
  }
}

/**
 * 5) Nocturna50: 19:00–05:00 (todo el periodo) → 50%
 */
export class Nocturna50Rule implements OvertimeRule {
  priority = 50;
  matches({ inicio }: TimeSegment): boolean {
    const h = inicio.hour();
    return h >= 19 || h < 5;
  }
  build(seg: TimeSegment): OvertimeSegment {
    return {
      inicio: seg.inicio.toDate(),
      fin: seg.fin.toDate(),
      tipo: 'nocturna50',
      porcentaje: 0.5
    };
  }
}

/**
 * Lista de todas las reglas en orden de prioridad ascendente.
 */
export const allOvertimeRules: OvertimeRule[] = [
  new Domingo100Rule(),
  new Sabado25Rule(),
  new NormalRule(),
  new Diurna25Rule(),
  new Mixta75Rule(),
  new Nocturna50Rule(),
];
