import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DeletionNotice, parseDeletionCode } from "./DeletionNotice";

describe("parseDeletionCode", () => {
  it("aceita código no formato base64url", () => {
    expect(parseDeletionCode("abcDEF123_-")).toBe("abcDEF123_-");
    expect(parseDeletionCode("a".repeat(64))).toBe("a".repeat(64));
  });
  it("rejeita vazio, grande demais, caracteres inválidos, lista e ausente", () => {
    expect(parseDeletionCode("")).toBeNull();
    expect(parseDeletionCode("a".repeat(65))).toBeNull();
    expect(parseDeletionCode("a b")).toBeNull();
    expect(parseDeletionCode('"><script>')).toBeNull();
    expect(parseDeletionCode(["abc", "def"])).toBeNull();
    expect(parseDeletionCode(undefined)).toBeNull();
  });
});

describe("DeletionNotice", () => {
  it("mostra aviso role=status com link para acompanhar", () => {
    const html = renderToStaticMarkup(createElement(DeletionNotice, { code: "abc-123" }));
    expect(html).toContain('role="status"');
    expect(html).toContain("Exclusão iniciada. Pode levar alguns minutos (até 24 horas em perfis muito grandes).");
    expect(html).toContain('href="/exclusao-de-dados?codigo=abc-123"');
    expect(html).toContain("Acompanhar");
  });
});
