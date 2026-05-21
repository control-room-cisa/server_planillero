import { describe, it, expect } from "vitest";
import {
  addDaysYmd,
  prismaDateToYmd,
  registroFechaToYmdSafe,
  ymdGt,
  ymdToPrismaDate,
} from "../src/utils/dateTime";

describe("dateTime (estándar YYYY-MM-DD)", () => {
  it("addDaysYmd coincide con PoliticaH1Base (UTC, sin getDate local)", () => {
    expect(addDaysYmd("2025-04-15", 1)).toBe("2025-04-16");
    expect(addDaysYmd("2025-12-31", 1)).toBe("2026-01-01");
  });

  it("prismaDateToYmd / ymdToPrismaDate round-trip", () => {
    const d = ymdToPrismaDate("2025-03-27");
    expect(prismaDateToYmd(d)).toBe("2025-03-27");
  });

  it("registroFechaToYmdSafe toma la parte fecha sin cambiar día", () => {
    expect(registroFechaToYmdSafe("2025-04-15")).toBe("2025-04-15");
    expect(registroFechaToYmdSafe("2025-04-15T18:30:00.000Z")).toBe(
      "2025-04-15",
    );
  });

  it("ymdGt compara calendario sin new Date()", () => {
    expect(ymdGt("2025-04-16", "2025-04-15")).toBe(true);
    expect(ymdGt("2025-04-15", "2025-04-15")).toBe(false);
  });
});
