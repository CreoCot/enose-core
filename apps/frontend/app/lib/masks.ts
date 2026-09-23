// Маски времени, как в MAG-soft. Маска — список моментов (секунды), в которых
// оцениваются кривые. В MAG-soft момент t — это индекс отсчёта (int(t)) в ряду
// измеренных точек (deltas[0] — первая точка после базовой, t ≈ 0), поэтому
// здесь так же: индекс = floor(t). Маска отсортирована; как только момент
// выходит за пределы данных, остальные (они больше) тоже отбрасываются.

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

export interface SummaryItem {
  baseFrequency: number;
  /** [время, ΔF] */
  minDelta: [number, number];
  maxDelta: [number, number];
  /** [время, |ΔF|] */
  absMax: [number, number];
}

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

/** Применяет маску к рядам ΔF. Без маски вызывать не нужно. */
export function applyMask(
  deltas: number[][],
  maskPoints: number[],
): MaskedSeries {
  const length = deltas.length ? Math.min(...deltas.map((d) => d.length)) : 0;
  const times: number[] = [];
  const indices: number[] = [];
  for (const t of maskPoints) {
    const k = Math.floor(t + EPS);
    if (k < 0 || k >= length) break;
    times.push(t);
    indices.push(k);
  }
  return { times, deltas: deltas.map((d) => indices.map((k) => d[k])) };
}

/** min / max / абсолютный максимум ΔF по точкам маски (как в MAG-soft). */
export function summarizeMasked(
  baseFrequencies: number[],
  masked: MaskedSeries,
): SummaryItem[] {
  return masked.deltas.map((d, i) => {
    let minIdx = -1;
    let maxIdx = -1;
    let absIdx = -1;
    for (let k = 0; k < d.length; k++) {
      if (minIdx < 0 || d[k] < d[minIdx]) minIdx = k;
      if (maxIdx < 0 || d[k] > d[maxIdx]) maxIdx = k;
      if (absIdx < 0 || Math.abs(d[k]) > Math.abs(d[absIdx])) absIdx = k;
    }
    const at = (idx: number, abs = false): [number, number] =>
      idx < 0 ? [0, 0] : [masked.times[idx], abs ? Math.abs(d[idx]) : d[idx]];
    return {
      baseFrequency: baseFrequencies[i] ?? 0,
      minDelta: at(minIdx),
      maxDelta: at(maxIdx),
      absMax: at(absIdx, true),
    };
  });
}

/** |ΔF| экстремума на каждом сенсоре — значения «диаграммы максимумов». */
export function maxDiagramValues(deltas: number[][]): number[] {
  return deltas.map((d) => (d.length ? Math.max(...d.map(Math.abs)) : 0));
}

/**
 * Площадь лепестковой диаграммы по формуле MAG-soft: сумма площадей
 * треугольников между соседними осями, Σ a·b·sin(2π/N)/2 по кругу.
 * values — уже отсчитанные от минимума оси.
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
