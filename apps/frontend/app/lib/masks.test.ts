import { describe, it, expect } from "vitest";
import {
  applyMask,
  axisMinFor,
  fingerprintRadii,
  maskSampleIndex,
  maxDiagramValues,
  normalizePoints,
  parseMaskInput,
  radarArea,
  summarizeMasked,
  timeDiagramValues,
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

describe("applyMask при шаге, отличном от секунды", () => {
  // отсчёты каждые 2 с: 2, 4, …, 120
  const times = Array.from({ length: 60 }, (_, k) => 2 * (k + 1));
  const deltas = [times.map((t) => t * 10)];
  it("точки маски — секунды, а не номера отсчётов", () => {
    const m = applyMask(deltas, [10, 20, 60, 100, 120], times);
    expect(m.times).toEqual([10, 20, 60, 100, 120]);
    expect(m.deltas[0]).toEqual([100, 200, 600, 1000, 1200]);
  });
  it("маска на 14 точек (0–130 с) не обрезается на 50-й секунде", () => {
    const mask = Array.from({ length: 14 }, (_, k) => k * 10);
    expect(applyMask(deltas, mask, times).times).toEqual(mask.slice(0, 13));
  });
  it("записи с шагом 1 с работают как раньше (floor(t))", () => {
    const t1 = [0, 1, 2, 3, 4, 5];
    expect(applyMask([[0, 1, 2, 3, 4, 5]], [1.9, 4.2], t1).deltas[0]).toEqual([
      1, 4,
    ]);
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

describe("timeDiagramValues", () => {
  // Два сенсора, два момента: оси идут time-major, как в MAG-soft
  const deltas = [
    [1, 2],
    [-1, 1],
  ];

  it("разворачивает оси как (время, сенсор)", () => {
    expect(timeDiagramValues(deltas)).toEqual([1, -1, 2, 1]);
  });

  it("обрезается по самому короткому сенсору", () => {
    expect(timeDiagramValues([[1, 2, 3], [4]])).toEqual([1, 4]);
  });

  it("не падает на пустых данных", () => {
    expect(timeDiagramValues([])).toEqual([]);
    expect(timeDiagramValues([[], []])).toEqual([]);
  });
});

describe("axisMinFor", () => {
  it("для модуля минимум оси равен нулю", () => {
    expect(axisMinFor([1, -1, 2, 1], "abs")).toBe(0);
  });
  it("для знакового режима берёт минимум по осям", () => {
    expect(axisMinFor([1, -1, 2, 1], "signed")).toBe(-1);
  });
  it("не падает на пустом списке", () => {
    expect(axisMinFor([], "signed")).toBe(0);
  });
});

describe("fingerprintRadii", () => {
  it("в режиме abs берёт модуль и вычитает минимум оси", () => {
    expect(fingerprintRadii([1, -1, 2, 1], "abs", 0)).toEqual([1, 1, 2, 1]);
    expect(fingerprintRadii([3, -5, 2], "abs", 2)).toEqual([1, 3, 0]);
  });

  it("в режиме signed вычитает минимум оси, как AxeMinVal в MAG-soft", () => {
    expect(fingerprintRadii([1, -1, 2, 1], "signed", -1)).toEqual([2, 0, 3, 2]);
  });

  it("не падает на пустом списке", () => {
    expect(fingerprintRadii([], "signed", 0)).toEqual([]);
    expect(fingerprintRadii([], "abs", 0)).toEqual([]);
  });
});

describe("площадь кинетического отпечатка", () => {
  it("канонический пример: оси [1,-1,2,1] со знаком дают 5", () => {
    const values = timeDiagramValues([
      [1, 2],
      [-1, 1],
    ]);
    const radii = fingerprintRadii(
      values,
      "signed",
      axisMinFor(values, "signed"),
    );
    expect(radii).toEqual([2, 0, 3, 2]);
    expect(radarArea(radii)).toBe(5);
  });

  it("эталон для сверки с Python (apps/report/app/areas.py)", () => {
    // Этот литерал продублирован в test_areas.py — менять только вместе
    expect(radarArea([1.5, 2.25, 0.75, 3.0, 2.0])).toBe(7.757054711032346);
  });
});

describe("maskSampleIndex", () => {
  const oneSecond = [0, 1, 2, 3, 4, 5];
  // шаг 2 с: 2, 4, …, 20
  const twoSeconds = Array.from({ length: 10 }, (_, k) => 2 * (k + 1));

  it("шаг ≈ 1 с: индекс = floor(t), как в MAG-soft", () => {
    expect(maskSampleIndex(oneSecond, 3)).toBe(3);
    expect(maskSampleIndex(oneSecond, 3.9)).toBe(3);
    expect(maskSampleIndex(oneSecond, 5)).toBe(5);
  });
  it("шаг 0.9 с (запись 301 с на 332 отсчёта) тоже считается секундным", () => {
    const times = Array.from({ length: 20 }, (_, k) => k * 0.9);
    expect(maskSampleIndex(times, 10)).toBe(10);
  });
  it("за пределами данных — -1", () => {
    expect(maskSampleIndex(oneSecond, 6)).toBe(-1);
    expect(maskSampleIndex(oneSecond, -1)).toBe(-1);
    expect(maskSampleIndex([], 0)).toBe(-1);
  });
  it("шаг 2 с: t — секунды, берётся ближайший отсчёт", () => {
    expect(maskSampleIndex(twoSeconds, 10)).toBe(4);
    expect(maskSampleIndex(twoSeconds, 11)).toBe(4);
    expect(maskSampleIndex(twoSeconds, 20)).toBe(9);
  });
  it("шаг 2 с: допускается половина шага за последним отсчётом", () => {
    expect(maskSampleIndex(twoSeconds, 21)).toBe(9);
    expect(maskSampleIndex(twoSeconds, 21.5)).toBe(-1);
  });
  it("один отсчёт не ломает расчёт шага", () => {
    expect(maskSampleIndex([0], 0)).toBe(0);
  });
});

describe("applyMask: порядок и пустая маска", () => {
  it("пустая маска даёт пустые ряды, число сенсоров сохраняется", () => {
    const m = applyMask(
      [
        [1, 2],
        [3, 4],
      ],
      [],
    );
    expect(m.times).toEqual([]);
    expect(m.deltas).toEqual([[], []]);
  });
  it("время отсчётов обрезается по самому короткому ряду", () => {
    const m = applyMask(
      [
        [1, 2, 3],
        [4, 5],
      ],
      [0, 1, 2],
    );
    expect(m.times).toEqual([0, 1]);
  });
});
