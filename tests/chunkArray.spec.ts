import { describe, it, expect } from "vitest";
import { chunkArray } from "../src/utils/chunkArray";

describe("chunkArray", () => {
  it("divide en chunks del tamaño indicado", () => {
    const arr = Array.from({ length: 501 }, (_, i) => i);
    const chunks = chunkArray(arr, 500);
    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toHaveLength(500);
    expect(chunks[1]).toHaveLength(1);
  });

  it("retorna un solo chunk si el array es menor", () => {
    expect(chunkArray([1, 2, 3], 500)).toEqual([[1, 2, 3]]);
  });
});
