import { describe, expect, it } from "vitest";
import { decodePostback, encodePostback } from "./postback";

describe("flow postback codec", () => {
  it.each(["question", "gate", "card"] as const)("round-trips %s without splitting IDs", (kind) => {
    const input = { kind, nodeId: "node_a_btn_b:ç", buttonId: "button_a_btn_b", runId: "run_123" };
    expect(decodePostback(encodePostback(input))).toEqual(input);
  });
  it.each(["node:abc_btn_def", "fluxo:not+base64", "fluxo:e30", "fluxo:" + "a".repeat(1000)])("rejects invalid payload %s", (input) => {
    expect(decodePostback(input)).toBeNull();
  });
  it("rejects unknown versions and extra data", () => {
    for (const input of [{ v: 2 }, { v: 1, extra: true }]) {
      const encoded = Buffer.from(JSON.stringify({ kind: "gate", nodeId: "n", runId: "r", ...input })).toString("base64url");
      expect(decodePostback("fluxo:" + encoded)).toBeNull();
    }
  });
  it("requires a run and enforces the byte limit", () => {
    expect(() => encodePostback({ kind: "gate", nodeId: "n", runId: "" })).toThrow();
    expect(() => encodePostback({ kind: "card", nodeId: "ç".repeat(200), buttonId: "ç".repeat(200), runId: "r".repeat(200) })).toThrow();
  });
});
