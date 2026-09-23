import { describe, it, expect } from "vitest";
import {
  fullXRange,
  niceCeil,
  niceStep,
  normalizeRange,
  padRange,
  visibleExtent,
  zoomRadarMax,
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

describe("niceStep / niceCeil", () => {
  it("подбирает шаг 1/2/5·10^n не более 12 делений", () => {
    expect(niceStep(37)).toBe(5);
    expect(niceStep(10)).toBe(1);
    expect(niceStep(4.5)).toBe(0.5);
    expect(niceStep(400)).toBe(50);
  });
  it("округляет максимум вверх до сетки", () => {
    expect(niceCeil(0, 37)).toBe(40);
    expect(niceCeil(0, 36)).toBe(40);
    expect(niceCeil(0, 4.3)).toBe(4.5);
  });
  it("не падает на вырожденном диапазоне", () => {
    expect(niceStep(0)).toBe(1);
  });
});

describe("zoomRadarMax", () => {
  it("приближение уменьшает максимум и привязывает к сетке", () => {
    // 40 / 1.1 = 36.4 -> 40, не сдвинулось -> на один шаг сетки (5) ниже
    expect(zoomRadarMax(0, 40, "in")).toBe(35);
  });
  it("отдаление увеличивает максимум", () => {
    // 35 * 1.1 = 38.5 -> 40
    expect(zoomRadarMax(0, 35, "out")).toBe(40);
  });
  it("каждый клик двигает ось минимум на один шаг сетки", () => {
    let max = 40;
    for (let i = 0; i < 6; i++) {
      const next = zoomRadarMax(0, max, "in");
      expect(next).toBeLessThan(max);
      max = next;
    }
    let up = 10;
    for (let i = 0; i < 6; i++) {
      const next = zoomRadarMax(0, up, "out");
      expect(next).toBeGreaterThan(up);
      up = next;
    }
  });
  it("учитывает ненулевой минимум", () => {
    const v = zoomRadarMax(10, 40, "in");
    expect(v).toBeGreaterThan(10);
    expect(v).toBeLessThan(40);
  });
  it("не даёт диапазону стать меньше MIN_SPAN", () => {
    expect(zoomRadarMax(0, 1.05, "in")).toBe(1.05);
    expect(zoomRadarMax(0, 1, "in")).toBe(1);
  });
});
