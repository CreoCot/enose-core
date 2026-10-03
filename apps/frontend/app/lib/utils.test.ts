import { describe, it, expect } from "vitest";
import {
  buildDeltaModel,
  cn,
  fullXRange,
  niceCeil,
  niceStep,
  normalizeRange,
  padRange,
  summarizeSeries,
  visibleExtent,
  zoomRadarMax,
} from "./utils";

describe("utils", () => {
  it("cn merges and resolves tailwind conflicts correctly", () => {
    // 1. Простая склейка (нет конфликтов)
    expect(cn("bg-red-500", "text-white")).toBe("bg-red-500 text-white");

    // 2. Разрешение конфликтов (p-4 перекрывает px-2 и py-1)
    expect(cn("px-2 py-1", "p-4")).toBe("p-4");

    // 3. Разрешение конфликтов цветов (последний выигрывает)
    expect(cn("bg-red-500", "bg-blue-500")).toBe("bg-blue-500");
  });
});

describe("buildDeltaModel", () => {
  // Данные из Examples/from_program.XML (сенсор SID0001): initial = 9952200,
  // время -1, затем 0, 1, 2, 3, 4 ...
  const timestamps = [-1, 0, 1, 2, 3, 4];
  const sensor = [9952200, 9952199, 9952198, 9952198, 9952190, 9952238];

  it("считает ΔF = F0 - F и отбрасывает базовую точку", () => {
    const m = buildDeltaModel(timestamps, [sensor]);
    expect(m.initial).toEqual([9952200]);
    expect(m.timestamps).toEqual([0, 1, 2, 3, 4]);
    expect(m.deltas[0]).toEqual([1, 2, 2, 10, -38]);
  });

  it("выравнивает время и значения по длине", () => {
    const m = buildDeltaModel(timestamps, [sensor, sensor]);
    expect(m.timestamps.length).toBe(m.deltas[0].length);
    expect(m.deltas.length).toBe(2);
  });

  it("без точки t < 0 (CSV/XLSX) базовой считает первую точку", () => {
    const m = buildDeltaModel([0, 2, 4], [[100, 90, 130]]);
    expect(m.initial).toEqual([100]);
    expect(m.timestamps).toEqual([2, 4]);
    expect(m.deltas[0]).toEqual([10, -30]);
  });

  it("не падает на пустых данных", () => {
    const m = buildDeltaModel([], []);
    expect(m.deltas).toEqual([]);
    expect(m.summary).toEqual([]);
  });

  it("сводка хранит время точки, а не индекс", () => {
    const m = buildDeltaModel(timestamps, [sensor]);
    expect(m.summary[0].baseFrequency).toBe(9952200);
    expect(m.summary[0].minDelta).toEqual([4, -38]);
    expect(m.summary[0].maxDelta).toEqual([3, 10]);
    expect(m.summary[0].absMax).toEqual([4, 38]);
  });
});

describe("summarizeSeries", () => {
  it("использует реальное время при неравномерной дискретизации", () => {
    const s = summarizeSeries(0, [0, 1, 5.02], [1, 2, 9]);
    expect(s.maxDelta).toEqual([5.02, 9]);
  });
});

describe("normalizeRange", () => {
  it("упорядочивает границы", () => {
    expect(normalizeRange(10, 2)).toEqual([2, 10]);
  });
  it("гарантирует минимальный диапазон", () => {
    expect(normalizeRange(5, 5.3)).toEqual([5, 6]);
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
    expect(hi - lo).toBeGreaterThanOrEqual(1);
  });
});

describe("fullXRange", () => {
  it("возвращает границы времени", () => {
    expect(fullXRange([0, 1, 300])).toEqual([0, 300]);
  });
  it("не падает на пустом ряде", () => {
    expect(fullXRange([])).toEqual([0, 1]);
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
  it("не даёт диапазону стать меньше минимального", () => {
    expect(zoomRadarMax(0, 1.05, "in")).toBe(1.05);
    expect(zoomRadarMax(0, 1, "in")).toBe(1);
  });
});
