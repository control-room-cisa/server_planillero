// src/services/OpenAIService.ts
import { AppError } from "../errors/AppError";

type ChatCompletionResponse = {
  choices?: Array<{
    message?: { content?: string | null };
  }>;
  error?: { message?: string };
};

const DEFAULT_MODEL = "gpt-4o-mini";

/**
 * Cliente mínimo de OpenAI (Chat Completions) vía fetch.
 * Usado para condensar comentarios de actividades por job en prorrateo.
 */
export class OpenAIService {
  static async resumirComentariosJob(
    comentarios: string[],
    contexto?: { codigoJob?: string | null; nombreJob?: string | null }
  ): Promise<string> {
    const textos = dedupeComentarios(comentarios);
    if (textos.length === 0) return "";
    if (textos.length === 1) return textos[0];

    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
      throw new AppError(
        "OPENAI_API_KEY no está configurada en el servidor",
        500
      );
    }

    const model =
      process.env.OPENAI_MODEL?.trim() || DEFAULT_MODEL;
    const jobLabel = [
      contexto?.codigoJob?.trim(),
      contexto?.nombreJob?.trim(),
    ]
      .filter(Boolean)
      .join(" — ");

    const system = [
      "Eres un asistente de nómina/prorrateo.",
      "Resume los comentarios de actividades de un job en un solo texto corto en español.",
      "Escribe siempre en pretérito (pasado): las actividades ya fueron realizadas en la quincena, aunque puedan continuar vigentes.",
      "Evita presente continuo o progresivo (p. ej. no digas «se está trabajando», «está realizando», «se está dando seguimiento»).",
      "Usa formas como «se trabajó», «se realizó», «se programó», «se dio seguimiento», «se hicieron pruebas».",
      "Corrige solo errores ortográficos evidentes de palabras comunes del español (p. ej. «preupuesto» → «presupuesto», «progrmacion» → «programación»).",
      "No «corrijas» nombres propios, marcas, códigos de job, siglas o acrónimos (p. ej. UPCO, IHSS, OT, PLC): déjalos tal cual aunque parezcan mal escritos.",
      "Si hay duda entre error ortográfico y nombre propio/sigla, no lo cambies.",
      "Une actividades repetidas (no las listes varias veces).",
      "No inventes trabajo que no aparezca en los comentarios.",
      "No uses viñetas ni numeración; un párrafo o dos como máximo.",
      "Máximo ~80 palabras.",
    ].join(" ");

    const user = [
      jobLabel ? `Job: ${jobLabel}` : null,
      "Comentarios:",
      ...textos.map((t, i) => `${i + 1}. ${t}`),
    ]
      .filter(Boolean)
      .join("\n");

    let data: ChatCompletionResponse;
    try {
      const response = await fetch(
        "https://api.openai.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model,
            temperature: 0.2,
            max_tokens: 250,
            messages: [
              { role: "system", content: system },
              { role: "user", content: user },
            ],
          }),
        }
      );

      data = (await response.json()) as ChatCompletionResponse;
      if (!response.ok) {
        throw new AppError(
          data?.error?.message ||
            `Error de OpenAI (${response.status})`,
          502
        );
      }
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw new AppError(
        "No se pudo generar el resumen de comentarios con OpenAI",
        502
      );
    }

    const content = data.choices?.[0]?.message?.content?.trim() ?? "";
    if (!content) {
      throw new AppError("OpenAI devolvió un resumen vacío", 502);
    }
    return content;
  }

  /**
   * Intenta resumir con OpenAI; si falla, concatena textos únicos como fallback.
   */
  static async resumirComentariosJobSafe(
    comentarios: string[],
    contexto?: { codigoJob?: string | null; nombreJob?: string | null }
  ): Promise<string> {
    const textos = dedupeComentarios(comentarios);
    if (textos.length === 0) return "";
    if (textos.length === 1) return textos[0];

    try {
      return await this.resumirComentariosJob(textos, contexto);
    } catch {
      return textos.join("; ").slice(0, 2000);
    }
  }
}

function dedupeComentarios(comentarios: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of comentarios) {
    const t = String(raw ?? "").trim();
    if (!t) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
}
