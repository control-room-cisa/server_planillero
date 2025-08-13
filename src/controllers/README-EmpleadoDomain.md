# EmpleadoDomainController - API Documentation

Este controlador proporciona endpoints para consultar datos del dominio de horarios de trabajo y cálculo de horas.

## Base URL

```
/api/empleados-domain
```

## Endpoints

### 1. Obtener Horario de Trabajo

**GET** `/api/empleados-domain/:empleadoId/horario/:fecha`

Obtiene el horario de trabajo de un empleado para una fecha específica.

#### Parámetros

- `empleadoId` (string): ID del empleado
- `fecha` (string): Fecha en formato YYYY-MM-DD

#### Respuesta Exitosa (200)

```json
{
  "success": true,
  "message": "Horario de trabajo obtenido exitosamente",
  "data": {
    "fecha": "2024-01-15",
    "empleadoId": "123",
    "horarioTrabajo": {
      "inicio": "08:00",
      "fin": "17:00"
    },
    "incluyeAlmuerzo": true,
    "esDiaLibre": false,
    "esFestivo": false,
    "nombreDiaFestivo": "",
    "cantidadHorasLaborables": 8
  }
}
```

### 2. Obtener Conteo de Horas

**GET** `/api/empleados-domain/:empleadoId/conteo-horas?fechaInicio=YYYY-MM-DD&fechaFin=YYYY-MM-DD`

Obtiene el conteo de horas trabajadas por un empleado en un período específico.

#### Parámetros

- `empleadoId` (string): ID del empleado
- `fechaInicio` (query string): Fecha de inicio en formato YYYY-MM-DD
- `fechaFin` (query string): Fecha de fin en formato YYYY-MM-DD

#### Respuesta Exitosa (200)

```json
{
  "success": true,
  "message": "Conteo de horas obtenido exitosamente",
  "data": {
    "fechaInicio": "2024-01-01",
    "fechaFin": "2024-01-31",
    "empleadoId": "123",
    "cantidadHoras": {
      "normal": 160,
      "p25": 10,
      "p50": 5,
      "p75": 8,
      "p100": 12
    }
  }
}
```

### 3. Obtener Línea de Tiempo del Día

**GET** `/api/empleados-domain/:empleadoId/linea-tiempo/:fecha`

Segmenta el día en intervalos de tiempo para un empleado y fecha específica.

#### Parámetros

- `empleadoId` (string): ID del empleado
- `fecha` (string): Fecha en formato YYYY-MM-DD

#### Respuesta Exitosa (200)

```json
{
  "success": true,
  "message": "Línea de tiempo obtenida exitosamente",
  "data": {
    "fecha": "2024-01-15",
    "empleadoId": "123",
    "intervalos": [
      {
        "horaInicio": "00:00",
        "horaFin": "08:00",
        "tipo": "LIBRE",
        "descripcion": "Fuera del horario laboral"
      },
      {
        "horaInicio": "08:00",
        "horaFin": "12:00",
        "tipo": "NORMAL",
        "jobId": 1,
        "descripcion": "Trabajo regular"
      },
      {
        "horaInicio": "12:00",
        "horaFin": "13:00",
        "tipo": "ALMUERZO",
        "descripcion": "Hora de almuerzo"
      },
      {
        "horaInicio": "13:00",
        "horaFin": "17:00",
        "tipo": "NORMAL",
        "jobId": 1,
        "descripcion": "Trabajo regular"
      },
      {
        "horaInicio": "17:00",
        "horaFin": "24:00",
        "tipo": "LIBRE",
        "descripcion": "Fuera del horario laboral"
      }
    ]
  }
}
```

### 4. Obtener Tipos de Horario Soportados

**GET** `/api/empleados-domain/tipos-horario/soportados`

Obtiene la lista de tipos de horario actualmente soportados.

#### Respuesta Exitosa (200)

```json
{
  "success": true,
  "message": "Tipos de horario soportados obtenidos exitosamente",
  "data": ["H1", "H2"]
}
```

### 5. Obtener Tipos de Horario Pendientes

**GET** `/api/empleados-domain/tipos-horario/pendientes`

Obtiene la lista de tipos de horario pendientes de implementación.

#### Respuesta Exitosa (200)

```json
{
  "success": true,
  "message": "Tipos de horario pendientes obtenidos exitosamente",
  "data": ["H3", "H4", "H5", "H6", "H7"]
}
```

## Errores Comunes

### 400 - Bad Request

```json
{
  "success": false,
  "message": "Formato de fecha inválido. Use YYYY-MM-DD",
  "data": null
}
```

### 404 - Not Found

```json
{
  "success": false,
  "message": "Empleado con ID 123 no encontrado",
  "data": null
}
```

### 500 - Internal Server Error

```json
{
  "success": false,
  "message": "Error interno del servidor",
  "data": null
}
```

## Autenticación

Todos los endpoints requieren autenticación. Incluir el token JWT en el header:

```
Authorization: Bearer <token>
```

## Tipos de Datos

### TipoIntervalo

- `NORMAL`: Horas regulares de trabajo
- `EXTRA`: Horas extras con recargo
- `ALMUERZO`: Hora de almuerzo
- `LIBRE`: Tiempo fuera del horario laboral

### Recargos de Horas

- `normal`: Horas regulares sin recargo
- `p25`: 25% de recargo
- `p50`: 50% de recargo
- `p75`: 75% de recargo
- `p100`: 100% de recargo (doble)
