import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ---------------------------------------------------------------------------
// ΔF-модель кривых сенсоров (логика MAG-soft)
// ---------------------------------------------------------------------------

/** Сводка по кривой одного сенсора: экстремумы ΔF с моментами времени. */
export interface SummaryItem {
  baseFrequency: number;
  /** [время, ΔF] точки минимума */
  minDelta: [number, number];
  /** [время, ΔF] точки максимума */
  maxDelta: [number, number];
  /** [время, |ΔF|] точки абсолютного максимума */
  absMax: [number, number];
}

interface DeltaModel {
  /** Времена измеренных точек (без базовой), выровнены с deltas */
  timestamps: number[];
  /** deltas[i][k] — ΔF i-го сенсора в момент timestamps[k] */
  deltas: number[][];
  /** Базовая частота каждого сенсора */
  initial: number[];
  summary: SummaryItem[];
}

/** min / max / абсолютный максимум ΔF по ряду (как в MAG-soft). */
export function summarizeSeries(
  baseFrequency: number,
  times: number[],
  delta: number[],
): SummaryItem {
  let minIdx = -1;
  let maxIdx = -1;
  let absIdx = -1;
  for (let k = 0; k < delta.length; k++) {
    if (minIdx < 0 || delta[k] < delta[minIdx]) minIdx = k;
    if (maxIdx < 0 || delta[k] > delta[maxIdx]) maxIdx = k;
    if (absIdx < 0 || Math.abs(delta[k]) > Math.abs(delta[absIdx])) absIdx = k;
  }
  const at = (idx: number, abs = false): [number, number] =>
    idx < 0 ? [0, 0] : [times[idx], abs ? Math.abs(delta[idx]) : delta[idx]];

  return {
    baseFrequency,
    minDelta: at(minIdx),
    maxDelta: at(maxIdx),
    absMax: at(absIdx, true),
  };
}

/**
 * Строит модель ΔF из «сырых» данных API (абсолютные частоты):
 * ΔF(t) = F0 − F(t), где F0 — базовая частота (точка time = -1 в XML).
 *
 * rawTimestamps — общий ряд времени, rawData[i] — ряд частот i-го сенсора.
 * Базовой считается последняя точка с t < 0; если такой нет (CSV/XLSX) —
 * первая точка. Базовая точка в результат не попадает.
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
  const summary: SummaryItem[] = [];

  for (const series of rawData) {
    const base = series[initialIdx] ?? 0;
    const d: number[] = [];
    for (let k = initialIdx + 1; k < series.length; k++) {
      d.push(base - series[k]);
    }
    initial.push(base);
    deltas.push(d);
    summary.push(summarizeSeries(base, timestamps, d));
  }

  return { timestamps, deltas, initial, summary };
}

// ---------------------------------------------------------------------------
// Масштабирование графиков (логика MAG-soft)
// ---------------------------------------------------------------------------

export type Range = [number, number];

/** Минимальный диапазон осей: 1 с / 1 Гц, как в MAG-soft */
const MIN_SPAN = 1;
/** Минимальный размер выделения в пикселях (как в MAG-soft) */
export const MIN_SELECTION_PX = 5;

/** Упорядочивает границы и гарантирует диапазон не меньше minSpan. */
export function normalizeRange(
  a: number,
  b: number,
  minSpan = MIN_SPAN,
): Range {
  const lo = Math.min(a, b);
  let hi = Math.max(a, b);
  if (hi - lo < minSpan) hi = lo + minSpan;
  return [lo, hi];
}

/** Min/max значений всех рядов в пределах xRange (если задан). */
export function visibleExtent(
  timestamps: number[],
  series: number[][],
  xRange?: Range | null,
): Range | null {
  let min = Infinity;
  let max = -Infinity;
  for (const data of series) {
    const n = Math.min(data.length, timestamps.length);
    for (let k = 0; k < n; k++) {
      if (xRange && (timestamps[k] < xRange[0] || timestamps[k] > xRange[1]))
        continue;
      const v = data[k];
      if (v < min) min = v;
      if (v > max) max = v;
    }
  }
  return min === Infinity ? null : [min, max];
}

/** Добавляет поля вокруг диапазона, чтобы линия не прилипала к краю. */
export function padRange(
  range: Range,
  ratio = 0.08,
  minSpan = MIN_SPAN,
): Range {
  const [lo, hi] = normalizeRange(range[0], range[1], minSpan);
  const pad = (hi - lo) * ratio;
  return [lo - pad, hi + pad];
}

/** Полный диапазон времени; при пустых данных — [0, MIN_SPAN]. */
export function fullXRange(timestamps: number[]): Range {
  if (timestamps.length === 0) return [0, MIN_SPAN];
  return normalizeRange(timestamps[0], timestamps[timestamps.length - 1]);
}

/** Шаг масштабирования диаграммы, как scaleStep в MAG-soft */
const RADAR_SCALE_STEP = 1.1;
/** Не больше стольки делений у оси радара (иначе подписи слипаются) */
const RADAR_MAX_DIVISIONS = 12;

const round10 = (v: number) => Number(v.toFixed(10));

/** «Красивый» шаг сетки (1, 2, 5 · 10^n), чтобы делений было не больше maxDivisions. */
export function niceStep(
  span: number,
  maxDivisions = RADAR_MAX_DIVISIONS,
): number {
  if (!(span > 0)) return 1;
  for (let exp = -3; exp <= 9; exp++) {
    for (const base of [1, 2, 5]) {
      const step = base * 10 ** exp;
      if (span / step <= maxDivisions) return step;
    }
  }
  return span / maxDivisions;
}

/** Ближайший сверху к max «красивый» максимум оси, отсчитанный от min. */
export function niceCeil(min: number, max: number): number {
  const step = niceStep(max - min);
  return round10(min + Math.ceil((max - min) / step - 1e-9) * step);
}

/**
 * Новый максимум оси радара при приближении ("in") или отдалении ("out").
 * Диапазон меняется в step раз (как в MAG-soft, шаг 1.1) и привязывается к
 * «красивой» сетке, чтобы подписи оси оставались круглыми; каждый клик
 * гарантированно сдвигает ось минимум на один шаг сетки. Приближение не
 * позволяет диапазону стать меньше MIN_SPAN.
 */
export function zoomRadarMax(
  min: number,
  max: number,
  direction: "in" | "out",
  step = RADAR_SCALE_STEP,
): number {
  const span = max - min;
  if (direction === "in") {
    const next = span / step;
    if (next < MIN_SPAN) return max;
    const grid = niceStep(next);
    let target = niceCeil(min, min + next);
    if (target >= max) target = round10(max - grid);
    return target - min < MIN_SPAN ? max : target;
  }
  const next = span * step;
  const grid = niceStep(next);
  let target = niceCeil(min, min + next);
  if (target <= max) target = round10(max + grid);
  return target;
}
