# Dominio de Horarios de Trabajo

Este módulo contiene la lógica de dominio para el manejo de horarios de trabajo, cálculo de horas y segmentación temporal.

## Estructura

### Tipos e Interfaces Principales

- **`HorarioTrabajo`**: Representa el horario de trabajo de un empleado en una fecha específica
- **`ConteoHorasTrabajadas`**: Conteo de horas trabajadas con diferentes tipos de recargo
- **`LineaTiempoDia`**: Línea de tiempo completa del día segmentada en intervalos
- **`IPoliticaHorario`**: Interfaz base para todas las políticas de horario

### Políticas de Horario

Las políticas de horario implementan diferentes reglas de cálculo según el tipo de turno:

- **`PoliticaH1`**: Horario estándar de oficina (8:00 - 17:00)
- **`PoliticaH2`**: Horario de turnos rotativos (6:00 - 18:00)
- **H3-H7**: Pendientes de implementación

### Componentes

1. **`HorarioTrabajoDomain`**: Servicio principal del dominio
2. **`SegmentadorTiempo`**: Segmenta el día en intervalos de 24 horas
3. **`FabricaPoliticas`**: Factory para crear instancias de políticas
4. **`PoliticaHorarioBase`**: Clase base con funcionalidad común

## Uso

### Obtener horario de trabajo

```typescript
import { HorarioTrabajoDomain } from "./domain";

const horario = await HorarioTrabajoDomain.getHorarioTrabajoByDateAndEmpleado(
  "2024-01-15",
  "123"
);
```

### Obtener conteo de horas

```typescript
const conteo =
  await HorarioTrabajoDomain.getConteoHorasTrabajadasByDateAndEmpleado(
    "2024-01-01",
    "2024-01-31",
    "123"
  );
```

### Segmentar línea de tiempo

```typescript
const lineaTiempo = await HorarioTrabajoDomain.segmentarLineaTiempoDia(
  "2024-01-15",
  "123"
);
```

## Validaciones

- Las fechas deben estar en formato YYYY-MM-DD
- El empleado debe tener un tipo de horario asignado
- Las horas normales deben cuadrar con la jornada laboral
- Se descuenta automáticamente 1 hora de almuerzo (excepto en hora corrida)

## Segmentación de Tiempo

El sistema segmenta el día en intervalos considerando:

- Puntos fijos: 00:00, 05:00, 12:00, 13:00, 19:00, 24:00
- Hora de entrada y salida del registro diario
- Actividades extras con horarios específicos
- Hora de almuerzo (12:00-13:00) cuando no es hora corrida

Los intervalos se clasifican como:

- **NORMAL**: Horas regulares de trabajo
- **EXTRA**: Horas extras con recargo
- **ALMUERZO**: Hora de almuerzo (sin descuento en hora corrida)
- **LIBRE**: Tiempo fuera del horario laboral
