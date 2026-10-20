import { describe, expect, it } from "vitest";
import {
  addDays,
  formatDate,
  formatTimelineDate,
  isYmd,
  monthGrid,
  monthLabel,
  shiftMonth,
  timeInZone,
  utcRange,
  weekDays,
  ymdInZone,
  zonedToUtc,
} from "./dates";

const SP = "America/Sao_Paulo";

describe("dias", () => {
  it("valida datas reais", () => {
    expect(isYmd("2026-10-13")).toBe(true);
    expect(isYmd("2026-02-30")).toBe(false);
    expect(isYmd("13/10/2026")).toBe(false);
  });

  it("semana vai de domingo a sábado", () => {
    expect(weekDays("2026-10-13")).toEqual([
      "2026-10-11", "2026-10-12", "2026-10-13", "2026-10-14", "2026-10-15", "2026-10-16", "2026-10-17",
    ]);
  });

  it("grade do mês cobre semanas completas como no Flux (27/09 a 31/10)", () => {
    const grid = monthGrid("2026-10-13");
    expect(grid[0][0]).toBe("2026-09-27");
    expect(grid.at(-1)?.at(-1)).toBe("2026-10-31");
    expect(grid.every((week) => week.length === 7)).toBe(true);
  });

  it("navega por meses e dias atravessando o ano", () => {
    expect(shiftMonth("2026-12-15", 1)).toBe("2027-01-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(monthLabel("2026-10-13")).toBe("Outubro, 2026");
  });
});

describe("fuso horário", () => {
  it("converte o horário de São Paulo para UTC", () => {
    expect(zonedToUtc("2026-10-14", "17:30", SP).toISOString()).toBe("2026-10-14T20:30:00.000Z");
  });

  it("volta do UTC para o dia e a hora locais", () => {
    const instant = new Date("2026-10-15T02:30:00Z");
    expect(ymdInZone(instant, SP)).toBe("2026-10-14");
    expect(timeInZone(instant, SP)).toBe("23:30");
  });

  it("intervalo de consulta cobre os dias inteiros no fuso", () => {
    const range = utcRange("2026-10-11", "2026-10-17", SP);
    expect(range.gte.toISOString()).toBe("2026-10-11T03:00:00.000Z");
    expect(range.lt.toISOString()).toBe("2026-10-18T03:00:00.000Z");
  });

  it("formata datas nos dois formatos do projeto", () => {
    const instant = zonedToUtc("2026-10-07", "10:06", SP);
    expect(formatDate(instant, SP, "DD/MM/YYYY")).toBe("07/10/2026");
    expect(formatDate(instant, SP, "MM/DD/YYYY")).toBe("10/07/2026");
    expect(formatTimelineDate(instant, SP, "DD/MM/YYYY")).toBe("07/10/26 às 10:06");
  });
});
