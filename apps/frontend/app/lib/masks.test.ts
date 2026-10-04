import { describe, it, expect } from "vitest";
import {
  applyMask,
  axisMinFor,
  fingerprintRadii,
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
