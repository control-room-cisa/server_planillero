# Cálculo de días de incapacidad — Método de Restos Mayores (LRM)

## Contexto

Las quincenas pueden tener **13, 14, 15 o 16 días** según el calendario. Todo el sistema de
planilla trabaja en **base 15** (quincena estándar). Para que los días de incapacidad sean
comparables entre quincenas de distinta longitud, se aplica una proporción:

```
raw_i = (días_intervalo_i / días_reales_quincena) × 15
```

El reto está en el **redondeo**: si hay varios intervalos de incapacidad, cada uno puede producir
un decimal pequeño. Redondeando individualmente (cada uno < 0.5 → piso) se perderían días que
colectivamente sí merecen ser contados.

---

## Algoritmo: Largest Remainder Method (LRM)

### Pasos

1. Calcular el valor proporcional `raw_i` para cada intervalo de incapacidad.
2. Asignar a cada intervalo su **piso**: `floor_i = Math.floor(raw_i)`.
3. Definir el **objetivo total**: `target = Math.round(∑ raw_i)`.
4. Calcular cuántos días "extra" faltan: `extra = target − ∑ floor_i`.
5. Ordenar los intervalos por su **parte decimal** de mayor a menor.
6. Asignar los días extra uno a uno a los intervalos con mayor decimal.

---

## Ejemplos

### Quincena de 16 días — tres intervalos: 2 + 3 + 4 días

| Intervalo | Días reales | raw = (días/16)×15 | Piso | Decimal |
|-----------|-------------|--------------------|------|---------|
| 1         | 2           | 1.875              | 1    | 0.875   |
| 2         | 3           | 2.8125             | 2    | 0.8125  |
| 3         | 4           | 3.750              | 3    | 0.750   |
| **Total** | **9**       | **8.4375**         | **6**|         |

- `target = round(8.4375) = 8`
- `extra = 8 − 6 = 2` → se asignan a decimales 0.875 y 0.8125
- **Resultado: [2, 3, 3] = 8 días** ✓

> Redondeo individual (≥ 0.5 → techo) daría [2, 3, 4] = **9 días** (sobre-cuenta 1).

---

### Quincena de 13 días — tres intervalos: 2 + 3 + 4 días

| Intervalo | Días reales | raw = (días/13)×15 | Piso | Decimal |
|-----------|-------------|--------------------|------|---------|
| 1         | 2           | 2.3077             | 2    | 0.3077  |
| 2         | 3           | 3.4615             | 3    | 0.4615  |
| 3         | 4           | 4.6154             | 4    | 0.6154  |
| **Total** | **9**       | **10.3846**        | **9**|         |

- `target = round(10.3846) = 10`
- `extra = 10 − 9 = 1` → se asigna al decimal 0.6154
- **Resultado: [2, 3, 5] = 10 días** ✓

> En una quincena corta, 4 días de incapacidad equivalen a 5 en base 15 porque la quincena
> tiene menos días que la estándar.

---

### Caso con decimales todos < 0.5 (ejemplo del usuario)

Supón tres intervalos cuyas proporciones dan: `raw = [0.30, 0.32, 0.40]`

| Intervalo | raw  | Piso | Decimal |
|-----------|------|------|---------|
| 1         | 0.30 | 0    | 0.30    |
| 2         | 0.32 | 0    | 0.32    |
| 3         | 0.40 | 0    | 0.40    |
| **Total** | 1.02 | **0**|         |

- `target = round(1.02) = 1`
- `extra = 1 − 0 = 1` → se asigna al decimal 0.40
- **Resultado: [0, 0, 1] = 1 día** ✓

> Sin LRM, los tres intervalos redondarían individualmente a 0 (todos < 0.5) y se perderían
> los días colectivamente acumulados.

---

## Por qué LRM y no redondeo individual

| Situación                                       | Redondeo individual | LRM   |
|-------------------------------------------------|---------------------|-------|
| Quincena 16 días, 9 días incapacidad            | 9 días (sobre)      | **8** |
| Quincena 13 días, 9 días incapacidad            | 11 días (sobre)     | **10**|
| Varios intervalos con decimal < 0.5             | 0 días (bajo)       | **1** |

LRM garantiza que la suma total de días asignados siempre coincide con `round(∑ raw_i)`,
sin sobre-contar ni sub-contar.

---

## Implementación

Los métodos relevantes están en `H1Base.ts`:

- `PoliticaH1Base.groupIncapIntervals(tipos, tipo)` — agrupa días consecutivos en intervalos.
- `PoliticaH1Base.lrmProportional(intervalDays, quincenahDays, baseDays)` — aplica LRM.

Se aplican por separado para incapacidad **empresa** (primeros 3 días consecutivos) e
incapacidad **IHSS** (a partir del 4.° día consecutivo).

La fórmula de `diasLaborados`:

```
diasLaborados = (15 − diasIncapEmpresa − diasIncapIHSS) − (diasVacaciones + diasPermisoCS + diasPermisoSS + diasInasistencias)
```
