import { describe, expect, it } from "vitest";
import { errorCode } from "./log-safe";

describe("errorCode", () => {
  it("prefere o code (Prisma) ao name", () => {
    expect(errorCode(Object.assign(new Error("SELECT * FROM x WHERE email='a@b.c'"), { code: "P2024" }))).toBe("P2024");
  });
  it("usa o name e nunca a mensagem", () => {
    const out = errorCode(new TypeError("https://graph.facebook.com/?access_token=segredo"));
    expect(out).toBe("TypeError");
    expect(out).not.toContain("segredo");
  });
  it("valores sem forma de erro viram UnknownError", () => {
    expect(errorCode(null)).toBe("UnknownError");
    expect(errorCode("texto com url")).toBe("UnknownError");
    expect(errorCode(undefined)).toBe("UnknownError");
    expect(errorCode({ code: 42 })).toBe("UnknownError");
  });
});
