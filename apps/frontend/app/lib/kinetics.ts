// Расчёт ΔF, как в MAG-soft: ΔF(t) = F0 - F(t), где F0 — базовая частота
// (точка time = -1 в XML). Положительная ΔF — частота упала.

export interface SensorSummaryData {
  baseFrequency: number;
  /** [время, ΔF] точки минимума */
  minDelta: [number, number];
  /** [время, ΔF] точки максимума */
  maxDelta: [number, number];
  /** [время, |ΔF|] точки абсолютного максимума */
  absMax: [number, number];
}

export interface DeltaModel {
  /** Времена измеренных точек (без базовой), выровнены с deltas */
  timestamps: number[];
  /** deltas[i][k] — ΔF i-го сенсора в момент timestamps[k] */
  deltas: number[][];
  /** Базовая частота каждого сенсора */
  initial: number[];
  summary: SensorSummaryData[];
}

/**
 * Строит модель ΔF из «сырых» данных API (абсолютные частоты).
 *
 * rawTimestamps — общий ряд времени, rawData[i] — ряд частот i-го сенсора.
 * Базовой считается последняя точка с t < 0 (в XML это time = -1). Если такой
 * точки нет (CSV/XLSX), базовой считается первая точка.
 */
export function buildDeltaModel(
  rawTimestamps: number[],
  rawData: number[][],
): DeltaModel {
  let initialIdx = 0;
  for (let k = 0; k < rawTimestamps.length; k++) {
    if (rawTimestamps[k] < 0) initialIdx = k;
    else break;
  }

  const timestamps = rawTimestamps.slice(initialIdx + 1);
  const initial: number[] = [];
  const deltas: number[][] = [];
  const summary: SensorSummaryData[] = [];

  for (const series of rawData) {
    const base = series[initialIdx] ?? 0;
    const d: number[] = [];
    for (let k = initialIdx + 1; k < series.length; k++) {
      d.push(base - series[k]);
    }
    initial.push(base);
    deltas.push(d);
    summary.push(summarize(base, timestamps, d));
  }

  return { timestamps, deltas, initial, summary };
}

export function summarize(
  baseFrequency: number,
  timestamps: number[],
  delta: number[],
): SensorSummaryData {
  let minIdx = -1;
  let maxIdx = -1;
  let absIdx = -1;
  for (let k = 0; k < delta.length; k++) {
    if (minIdx < 0 || delta[k] < delta[minIdx]) minIdx = k;
    if (maxIdx < 0 || delta[k] > delta[maxIdx]) maxIdx = k;
    if (absIdx < 0 || Math.abs(delta[k]) > Math.abs(delta[absIdx])) absIdx = k;
  }
  const at = (idx: number, abs = false): [number, number] =>
    idx < 0
      ? [0, 0]
      : [timestamps[idx], abs ? Math.abs(delta[idx]) : delta[idx]];

  return {
    baseFrequency,
    minDelta: at(minIdx),
    maxDelta: at(maxIdx),
    absMax: at(absIdx, true),
  };
}
