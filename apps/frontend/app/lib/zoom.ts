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
