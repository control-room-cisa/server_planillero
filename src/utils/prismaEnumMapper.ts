import fs from "fs";
import path from "path";

/**
 * Lee el schema.prisma y extrae los valores @map de los enums automáticamente.
 * Esto evita tener que mantener manualmente los mapeos cuando se modifican los @map en el schema.
 */

interface EnumMapping {
  [enumValue: string]: string;
}

/**
 * Parsea el schema.prisma y extrae los mapeos de un enum específico
 */
function parseEnumMapping(
  schemaContent: string,
  enumName: string
): EnumMapping {
  const mapping: EnumMapping = {};

  // Buscar el enum en el schema
  const enumRegex = new RegExp(`enum\\s+${enumName}\\s*\\{[^}]*\\}`, "s");
  const enumMatch = schemaContent.match(enumRegex);

  if (!enumMatch) {
    console.warn(`Enum ${enumName} no encontrado en el schema`);
    return mapping;
  }

  const enumBlock = enumMatch[0];

  // Dividir en líneas y procesar cada una
  const lines = enumBlock.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();

    // Saltar líneas vacías, comentarios puros (sin enum), o llaves
    if (
      !trimmed ||
      (trimmed.startsWith("//") && !trimmed.includes("@map")) ||
      trimmed === "{" ||
      trimmed === "}"
    ) {
      continue;
    }

    // Buscar: VALOR @map("valor") (activo)
    const activeMapMatch = trimmed.match(/^(\w+)\s+@map\(["']([^"']+)["']\)/);
    if (activeMapMatch) {
      const [, enumValue, mappedValue] = activeMapMatch;
      mapping[enumValue] = mappedValue;
      continue;
    }

    // Buscar: VALOR //@map("valor") (comentado - usar el valor comentado)
    const commentedMapMatch = trimmed.match(
      /^(\w+)\s*\/\/@map\(["']([^"']+)["']\)/
    );
    if (commentedMapMatch) {
      const [, enumValue, mappedValue] = commentedMapMatch;
      mapping[enumValue] = mappedValue;
      continue;
    }

    // Buscar: VALOR sin @map (usar formato legible del nombre)
    const noMapMatch = trimmed.match(/^(\w+)/);
    if (noMapMatch) {
      const enumValue = noMapMatch[1];
      mapping[enumValue] = formatEnumValue(enumValue);
    }
  }

  return mapping;
}

/**
 * Formatea un valor de enum para que sea más legible cuando no tiene @map
 */
function formatEnumValue(enumValue: string): string {
  // Convertir H1_1 -> "H1.1", T7X7 -> "7x7", etc.
  return enumValue
    .replace(/_/g, ".")
    .replace(/([A-Z])([A-Z]+)/g, (match, p1, p2) => {
      // Si hay múltiples mayúsculas seguidas, mantenerlas juntas
      return match;
    })
    .replace(/([a-z])([A-Z])/g, "$1 $2") // Agregar espacio entre palabras
    .replace(/^T(\d+)/, "$1") // Remover T inicial de TipoContrato
    .trim();
}

/**
 * Lee el schema.prisma y retorna los mapeos de un enum
 */
function getEnumMapping(enumName: string): EnumMapping {
  const schemaPath = path.join(__dirname, "../../prisma/schema.prisma");

  try {
    const schemaContent = fs.readFileSync(schemaPath, "utf-8");
    return parseEnumMapping(schemaContent, enumName);
  } catch (error) {
    console.error(`Error al leer schema.prisma para enum ${enumName}:`, error);
    return {};
  }
}

/**
 * Mapea un valor de enum a su valor @map correspondiente
 */
export function mapEnumValue(
  enumName: "TipoHorario" | "TipoContrato" | "TipoCuenta",
  enumValue: string | null | undefined
): string | undefined {
  if (!enumValue) return undefined;

  const mapping = getEnumMapping(enumName);
  return mapping[enumValue] || enumValue;
}

/**
 * Funciones específicas para cada enum (cacheadas para mejor rendimiento)
 */
let tipoHorarioMapping: EnumMapping | null = null;
let tipoContratoMapping: EnumMapping | null = null;
let tipoCuentaMapping: EnumMapping | null = null;

export function mapTipoHorario(
  tipoHorario: string | null | undefined
): string | undefined {
  if (!tipoHorario) return undefined;
  if (!tipoHorarioMapping) {
    tipoHorarioMapping = getEnumMapping("TipoHorario");
  }
  return tipoHorarioMapping[tipoHorario] || tipoHorario;
}

export function mapTipoContrato(
  tipoContrato: string | null | undefined
): string | undefined {
  if (!tipoContrato) return undefined;
  if (!tipoContratoMapping) {
    tipoContratoMapping = getEnumMapping("TipoContrato");
  }
  return tipoContratoMapping[tipoContrato] || tipoContrato;
}

export function mapTipoCuenta(
  tipoCuenta: string | null | undefined
): string | undefined {
  if (!tipoCuenta) return undefined;
  if (!tipoCuentaMapping) {
    tipoCuentaMapping = getEnumMapping("TipoCuenta");
  }
  return tipoCuentaMapping[tipoCuenta] || tipoCuenta;
}
