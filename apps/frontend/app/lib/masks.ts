// Маски времени, как в MAG-soft. Маска — список моментов (секунды), в которых
// оцениваются кривые. В MAG-soft момент t — это индекс отсчёта (int(t)) в ряду
// измеренных точек (deltas[0] — первая точка после базовой, t ≈ 0), поэтому
// для записей с шагом ≈ 1 с индекс = floor(t); при другом шаге t — секунды
// и берётся ближайший по времени отсчёт. Маска отсортирована; как только момент
// выходит за пределы данных, остальные (они больше) тоже отбрасываются.

import { summarizeSeries, type SummaryItem } from "./utils";

export interface Mask {
  id: number;
  name: string;
  points: number[];
  created_by: number | null;
  editable: boolean;
}

export interface MaskedSeries {
  /** Моменты маски, попавшие в данные (ось X графиков) */
  times: number[];
  /** deltas[i][k] — ΔF i-го сенсора в момент times[k] */
  deltas: number[][];
}

// Сводка по кривой одинаковая и с маской, и без неё — тип и расчёт общие.
export type { SummaryItem };

const EPS = 1e-9;

/** Разбирает текст с точками: разделители — пробел, перевод строки, `;`, `,`. */
export function parseMaskInput(text: string): {
  points: number[];
  error: string | null;
} {
  const tokens = text.split(/[\s;,]+/).filter(Boolean);
  const points: number[] = [];
  for (const token of tokens) {
    const value = Number(token);
    if (!Number.isFinite(value)) {
      return { points: [], error: `«${token}» — не число` };
    }
    if (value < 0) {
      return { points: [], error: "Время не может быть отрицательным" };
    }
    points.push(value);
  }
  return { points, error: null };
}

/** Канонический вид точек: по возрастанию, без дублей (как на сервере). */
export function normalizePoints(points: number[]): number[] {
  const sorted = points
    .map((p) => Math.round(p * 1000) / 1000)
    .sort((a, b) => a - b);
  return sorted.filter((p, i) => i === 0 || p !== sorted[i - 1]);
}

/** Точки маски → строка для редактирования. */
export function formatMaskPoints(points: number[]): string {
  return points.join(" ");
}

/** Медианный шаг по времени; 0, если отсчётов меньше двух. */
function medianStep(times: number[]): number {
  if (times.length < 2) return 0;
  const steps = times
    .slice(1)
    .map((t, i) => t - times[i])
    .sort((a, b) => a - b);
  return steps[Math.floor(steps.length / 2)];
}

// Шаг около секунды — запись MAG-soft, где момент маски и есть номер отсчёта.
const LEGACY_STEP_TOLERANCE = 0.2;

/**
 * Номер отсчёта для момента маски t или -1, если t вышел за пределы данных.
 * times — время отсчётов ПОСЛЕ базовой точки.
 * - шаг ≈ 1 с (записи MAG-soft): как в легаси, отсчёт = floor(t);
 * - иной шаг (например, 2 с): t — секунды, берётся ближайший по времени
 *   отсчёт. Иначе маска «0 10 … 130» на записи с шагом 2 с обрезалась бы
 *   на 50-й секунде, потому что «60-й отсчёт» лежит на 120-й секунде.
 */
export function maskSampleIndex(times: number[], t: number): number {
  if (times.length === 0) return -1;
  const step = medianStep(times);
  if (step <= 0 || Math.abs(step - 1) <= LEGACY_STEP_TOLERANCE) {
    const k = Math.floor(t + EPS);
    return k < 0 || k >= times.length ? -1 : k;
  }
  if (t > times[times.length - 1] + step / 2 + EPS) return -1;
  let best = 0;
  for (let k = 1; k < times.length; k++) {
    if (Math.abs(times[k] - t) < Math.abs(times[best] - t)) best = k;
  }
  return best;
}

/** Применяет маску к рядам ΔF. Без маски вызывать не нужно. */
export function applyMask(
  deltas: number[][],
  maskPoints: number[],
  sampleTimes: number[] = [],
): MaskedSeries {
  const length = deltas.length ? Math.min(...deltas.map((d) => d.length)) : 0;
  // Время отсчётов: если не передано, считаем шаг равным секунде (легаси)
  const times = sampleTimes.length
    ? sampleTimes.slice(0, length)
    : Array.from({ length }, (_, k) => k);
  const kept: number[] = [];
  const indices: number[] = [];
  for (const t of maskPoints) {
    const k = maskSampleIndex(times, t);
    if (k < 0) break;
    kept.push(t);
    indices.push(k);
  }
  return { times: kept, deltas: deltas.map((d) => indices.map((k) => d[k])) };
}

/** min / max / абсолютный максимум ΔF по точкам маски (как в MAG-soft). */
export function summarizeMasked(
  baseFrequencies: number[],
  masked: MaskedSeries,
): SummaryItem[] {
  return masked.deltas.map((d, i) =>
    summarizeSeries(baseFrequencies[i] ?? 0, masked.times, d),
  );
}

/** |ΔF| экстремума на каждом сенсоре — значения «диаграммы максимумов». */
export function maxDiagramValues(deltas: number[][]): number[] {
  return deltas.map((d) => (d.length ? Math.max(...d.map(Math.abs)) : 0));
}

/**
 * Радиусы «временной диаграммы» MAG-soft. Оси идут time-major: ось j — это
 * (время j / sensorCount, сенсор j % sensorCount), ровно как в легаси
 * `Math.DivRem(j, DivMidGridAxes, out sensorIdx)`, где DivMidGridAxes — число
 * сенсоров. Значение оси — ΔF этого сенсора в этот момент (со знаком).
 */
export function timeDiagramValues(deltas: number[][]): number[] {
  const sensorCount = deltas.length;
  if (sensorCount === 0) return [];
  const pointCount = Math.min(...deltas.map((d) => d.length));
  const values: number[] = [];
  for (let j = 0; j < pointCount * sensorCount; j++) {
    values.push(deltas[j % sensorCount][Math.floor(j / sensorCount)]);
  }
  return values;
}

/** Режим расчёта площади: по модулю ΔF или со знаком (как в MAG-soft). */
export type AreaMode = "abs" | "signed";

/**
 * Минимум радиальной оси по умолчанию (AxeMinVal в легаси): для модуля это 0,
 * для знакового режима — минимум по всем осям, иначе отрицательные лепестки
 * обрежутся.
 */
export function axisMinFor(values: number[], mode: AreaMode): number {
  if (mode === "abs" || values.length === 0) return 0;
  return Math.min(...values);
}

/**
 * Радиусы осей для расчёта площади, отсчитанные от минимума оси axisMin
 * (в легаси — вычитание AxeMinVal перед TriangleSquare).
 * - `abs` — |ΔF| минус минимум оси, с обрезкой снизу нулём;
 * - `signed` — ΔF минус минимум оси, как в MAG-soft: отрицательные лепестки
 *   дают меньший радиус, а не больший.
 */
export function fingerprintRadii(
  values: number[],
  mode: AreaMode,
  axisMin: number,
): number[] {
  return mode === "abs"
    ? values.map((v) => Math.max(0, Math.abs(v) - axisMin))
    : values.map((v) => v - axisMin);
}

/**
 * Площадь лепестковой диаграммы по формуле MAG-soft: сумма площадей
 * треугольников между соседними осями, Σ a·b·sin(2π/N)/2 по кругу.
 * values — уже отсчитанные от минимума оси.
 *
 * Порядок операций повторяется в apps/report/app/areas.py (Python), поэтому
 * множитель s вынесен из суммы один раз и накопление идёт по возрастанию i —
 * менять это нельзя, иначе округление разойдётся между языками.
 */
export function radarArea(values: number[]): number {
  const n = values.length;
  if (n < 3) return 0;
  const s = Math.sin((2 * Math.PI) / n) / 2;
  let area = 0;
  for (let i = 0; i < n; i++) {
    area += values[i] * values[(i + 1) % n] * s;
  }
  return area;
}
