// Масштабирование графиков, как в MAG-soft: выделение области мышью,
// автомасштаб по Y, минимальный диапазон 1 (с / Гц), сброс.

export type Range = [number, number];

export const MIN_SPAN = 1;
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
export const RADAR_SCALE_STEP = 1.1;
/** Не больше стольки делений у оси радара (иначе подписи слипаются) */
export const RADAR_MAX_DIVISIONS = 12;

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
