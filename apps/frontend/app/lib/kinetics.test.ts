import { describe, it, expect } from "vitest";
import { buildDeltaModel, summarize } from "./kinetics";

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

  it("сводка использует реальное время при неравномерной дискретизации", () => {
    const s = summarize(0, [0, 1, 5.02], [1, 2, 9]);
    expect(s.maxDelta).toEqual([5.02, 9]);
  });
});
