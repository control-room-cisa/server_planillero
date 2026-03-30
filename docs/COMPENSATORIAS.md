# Horas Compensatorias



## Concepto



Las horas compensatorias son un mecanismo de banco de tiempo: el empleado puede **tomar** tiempo libre (reducir su jornada normal) y luego **devolver** ese tiempo trabajando horas extra en otro día.



Cada actividad en el registro diario puede tener el flag `esCompensatorio = true` para indicar que pertenece a este banco.



---



## Tipos de horas compensatorias



### 1. Compensatorias Tomadas (`esExtra = false`, `esCompensatorio = true`)



El empleado **retira horas del banco**: trabaja menos de su jornada normal ese día.



- **Sin job asignado** — no representan producción en ningún proyecto.

- **No cuentan en `totalHorasLaborables`** del prorrateo.

- **No cuentan en `cantidadHoras.normal`** del conteo base.

- Se acumulan en el campo `horasCompensatoriasTomadas` del resultado del prorrateo.

- En el segmentador, los slots correspondientes al final del rango normal se convierten de `NORMAL` → `LIBRE` (despintado).



**Ejemplo:**

```

Jornada normal: 07:00–17:00  (9 h + 1 h almuerzo = 10 h rango)

Actividad:  esExtra=false, esCompensatorio=true, duracionHoras=4

Resultado:  últimas 4 h del rango (13:00–17:00) pasan a LIBRE

            horasCompensatoriasTomadas = 4

            totalHorasLaborables = 5  (solo las 5 h restantes)

```



---



### 2. Compensatorias Devueltas (`esExtra = true`, `esCompensatorio = true`)



El empleado **deposita horas en el banco**: trabaja fuera de su jornada normal para reintegrar tiempo que tomó previamente.



- **Con job asignado** — se registra en qué proyecto se trabajó.

- **Valor = horas normales** — no se aplican porcentajes de horas extra (p25 / p50 / p75 / p100).

- **No se incluyen en** `totalHorasExtra` ni en los mapas `p25/p50/p75/p100`.

- Se acumulan en el campo `horasCompensatoriasDevueltasPorJob[]` del resultado del prorrateo.

- La duración se calcula directamente desde `horaFin - horaInicio`, **sin distinción diurna/nocturna**.



**Efecto en la racha de extras:**

Las compensatorias devueltas avanzan el acumulador de racha (`minutosP50Acum`) como si fueran horas a nivel p50, y activan `existeDiurnaExtra` si ocurren en franja diurna (05:00–19:00). Esto permite que las horas extra ordinarias que siguen inmediatamente a un bloque de compensatorias devueltas escalen correctamente a p75 o p100.



**Ejemplo:**

```

17:00–20:00  esExtra=true, esCompensatorio=true, job=300  →  3 h compensatorias devueltas

20:00–22:00  esExtra=true, esCompensatorio=false, job=400  →  2 h extra ordinarias



Racha al llegar al slot 20:00:

  piso = 1.5, existeDiurnaExtra = true, minutosP50Acum = 180 min (3 h × 60)



Clasificación de 20:00–22:00:

  aplicarP75 = (180 >= 180) AND existeDiurnaExtra  →  true

  → 2 h a 75%  (job 400)



horasCompensatoriasDevueltasPorJob = [{ codigoJob: "300", cantidadHoras: 3 }]

```



---



## Campos en el resultado del prorrateo



| Campo | Tipo | Descripción |

|---|---|---|

| `horasCompensatoriasTomadas` | `number?` | Total de horas normales tomadas como compensatorio (sin job). Omitido si es 0. |

| `horasCompensatoriasDevueltasPorJob` | `HorasPorJob[]?` | Horas compensatorias devueltas, desglosadas por job. Omitido si vacío. |



En el conteo base (`ConteoHorasTrabajadas`), el total agregado de horas extra compensatorias del período va en `cantidadHoras.horasCompensatoriasDevueltas` (no es pago monetario: es tiempo devuelto al banco).



---



## Impacto en `totalHorasLaborables`



`totalHorasLaborables` refleja **solo las horas efectivamente laboradas** en el período. Las compensatorias tomadas **reducen** las horas laborables del día (los slots se convierten a LIBRE en el segmentador). Las compensatorias devueltas **no suman** a `totalHorasLaborables` (son tiempo de reintegro, no jornada nueva).



---



## Implementación técnica



| Componente | Cambio |

|---|---|

| `segmentador.ts` | `Segmento15.esCompensatorio?` en extras; compensatorias tomadas a LIBRE (sección 4.5). Agregación de devueltas: `horasCompensatoriasDevueltasMap` → `horasCompensatoriasDevueltas[]`. |

| `H1Base.aplicarExtraSlotCompensatorio()` | Avanza la racha (piso=1.5, minutosP50Acum+15) y escribe en `compExtrasMin`. |

| `H1Base.procesarDiaCompletamente()` | Segmentos EXTRA con `esCompensatorio=true` llaman al nuevo método. |

| `H1Base` (totales de conteo) | Suma minutos desde `segmentosResult.horasCompensatoriasDevueltas` hacia `compExtrasMin` → `cantidadHoras.horasCompensatoriasDevueltas`. |
