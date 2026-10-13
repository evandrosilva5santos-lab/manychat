import { describe, expect, it } from "vitest";
import { safeNextPath } from "./next-path";

describe("safeNextPath", () => {
  it.each([
    ["/convite/abc", "/convite/abc"],
    ["/fluxos?x=1", "/fluxos?x=1"],
    [null, "/"],
    ["", "/"],
    ["https://mal.com", "/"],
    ["//mal.com", "/"],
    ["/\\mal.com", "/"],
    ["javascript:alert(1)", "/"],
  ])("%s → %s", (input, expected) => {
    expect(safeNextPath(input)).toBe(expected);
  });
});
