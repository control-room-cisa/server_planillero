# Cálculo de Horas de Trabajo - API Documentation

Este controlador proporciona endpoints para consultar datos relacionados con el cálculo de horas de trabajo y horarios.

## Base URL

```
/api/calculo-horas
```

## Endpoints

### 1. Obtener Horario de Trabajo

**GET** `/api/calculo-horas/:empleadoId/horario/:fecha`

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

**GET** `/api/calculo-horas/:empleadoId/conteo-horas?fechaInicio=YYYY-MM-DD&fechaFin=YYYY-MM-DD`

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

### Recargos de Horas

- `normal`: Horas regulares sin recargo
- `p25`: 25% de recargo
- `p50`: 50% de recargo
- `p75`: 75% de recargo
- `p100`: 100% de recargo (doble)
