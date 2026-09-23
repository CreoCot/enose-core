import { describe, it, expect } from "vitest";
import {
  fullXRange,
  normalizeRange,
  padRange,
  visibleExtent,
  MIN_SPAN,
} from "./zoom";

describe("normalizeRange", () => {
  it("упорядочивает границы", () => {
    expect(normalizeRange(10, 2)).toEqual([2, 10]);
  });
  it("гарантирует минимальный диапазон", () => {
    expect(normalizeRange(5, 5.3)).toEqual([5, 5 + MIN_SPAN]);
    expect(normalizeRange(5, 5)).toEqual([5, 6]);
  });
});

describe("visibleExtent", () => {
  const t = [0, 1, 2, 3, 4];
  const a = [1, 5, 2, 9, 3];
  const b = [-4, 0, 1, 2, 3];

  it("берёт min/max по всем точкам без окна", () => {
    expect(visibleExtent(t, [a, b])).toEqual([-4, 9]);
  });
  it("учитывает только точки внутри окна по X", () => {
    expect(visibleExtent(t, [a, b], [1, 2])).toEqual([0, 5]);
  });
  it("возвращает null, если в окне нет точек", () => {
    expect(visibleExtent(t, [a], [10, 20])).toBeNull();
  });
});

describe("padRange", () => {
  it("добавляет поля по краям", () => {
    const [lo, hi] = padRange([0, 100], 0.1);
    expect(lo).toBeCloseTo(-10);
    expect(hi).toBeCloseTo(110);
  });
  it("расширяет вырожденный диапазон до минимального", () => {
    const [lo, hi] = padRange([5, 5]);
    expect(hi - lo).toBeGreaterThanOrEqual(MIN_SPAN);
  });
});

describe("fullXRange", () => {
  it("возвращает границы времени", () => {
    expect(fullXRange([0, 1, 300])).toEqual([0, 300]);
  });
  it("не падает на пустом ряде", () => {
    expect(fullXRange([])).toEqual([0, MIN_SPAN]);
  });
});
