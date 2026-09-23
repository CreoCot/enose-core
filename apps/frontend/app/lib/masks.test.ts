import { describe, it, expect } from "vitest";
import {
  applyMask,
  maxDiagramValues,
  normalizePoints,
  parseMaskInput,
  radarArea,
  summarizeMasked,
} from "./masks";

describe("parseMaskInput", () => {
  it("разбирает разные разделители", () => {
    expect(parseMaskInput("0 10\n20;30, 60").points).toEqual([
      0, 10, 20, 30, 60,
    ]);
  });
  it("возвращает ошибку на нечисловом токене", () => {
    const r = parseMaskInput("10 abc 20");
    expect(r.error).toContain("abc");
    expect(r.points).toEqual([]);
  });
  it("не принимает отрицательное время", () => {
    expect(parseMaskInput("-5 10").error).not.toBeNull();
  });
  it("пустая строка — пустой список без ошибки", () => {
    expect(parseMaskInput("  \n ")).toEqual({ points: [], error: null });
  });
});

describe("normalizePoints", () => {
  it("сортирует и убирает дубли", () => {
    expect(normalizePoints([30, 10, 10, 20])).toEqual([10, 20, 30]);
  });
});

describe("applyMask", () => {
  const deltas = [
    [0, 1, 2, 3, 4, 5],
    [10, 11, 12, 13, 14, 15],
  ];
  it("берёт отсчёты по индексу floor(t)", () => {
    const m = applyMask(deltas, [1, 3, 5]);
    expect(m.times).toEqual([1, 3, 5]);
    expect(m.deltas).toEqual([
      [1, 3, 5],
      [11, 13, 15],
    ]);
  });
  it("дробное время усекается, как (int)t в MAG-soft", () => {
    expect(applyMask(deltas, [1.9, 4.2]).deltas[0]).toEqual([1, 4]);
  });
  it("отбрасывает точки за пределами данных и всё после них", () => {
    const m = applyMask(deltas, [2, 6, 100]);
    expect(m.times).toEqual([2]);
    expect(m.deltas[1]).toEqual([12]);
  });
  it("пустые данные — пустой результат", () => {
    expect(applyMask([], [1, 2])).toEqual({ times: [], deltas: [] });
  });
});

describe("summarizeMasked", () => {
  it("считает min/max/абсолютный максимум по точкам маски", () => {
    const masked = { times: [10, 20, 30], deltas: [[2, -7, 5]] };
    const [s] = summarizeMasked([9952200], masked);
    expect(s.baseFrequency).toBe(9952200);
    expect(s.minDelta).toEqual([20, -7]);
    expect(s.maxDelta).toEqual([30, 5]);
    expect(s.absMax).toEqual([20, 7]);
  });
});

describe("maxDiagramValues", () => {
  it("возвращает максимум модуля по каждому сенсору", () => {
    expect(maxDiagramValues([[1, -4, 2], [0, 0, 0], []])).toEqual([4, 0, 0]);
  });
});

describe("radarArea", () => {
  it("равносторонний случай: 4 оси по 1 — площадь квадрата-ромба 2", () => {
    // Σ 4 · (1·1·sin(90°)/2) = 2
    expect(radarArea([1, 1, 1, 1])).toBeCloseTo(2, 10);
  });
  it("6 осей по 2: 6 · (4·sin(60°)/2)", () => {
    expect(radarArea([2, 2, 2, 2, 2, 2])).toBeCloseTo(
      (6 * 4 * Math.sin(Math.PI / 3)) / 2,
      10,
    );
  });
  it("меньше трёх осей — 0", () => {
    expect(radarArea([1, 2])).toBe(0);
  });
});
