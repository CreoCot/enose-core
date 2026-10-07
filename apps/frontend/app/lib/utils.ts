import { createContext } from "react";
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
/**
 * Не больше стольки колец у радара. Кольца подписаны числами, поэтому их
 * мало: ось всегда заканчивается на круглом значении, кратном шагу колец
 * (40, а не 37), и крупные подписи для статьи не налезают друг на друга.
 */
const RADAR_MAX_DIVISIONS = 5;

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

/**
 * Круглые границы оси для данных [min, max]: обе кратны одному шагу, и ноль
 * остаётся на сетке. Нужна для знаковых значений: от «сырого» минимума
 * (−31) кольца получаются некруглыми (−31, −11, 9…), а от −40 — круглыми.
 */
export function niceRange(min: number, max: number): [number, number] {
  let lo = Math.min(min, 0);
  let hi = Math.max(max, lo + MIN_SPAN);
  // Шаг зависит от размаха, а размах после округления растёт — доводим до
  // устойчивого значения (хватает двух-трёх проходов)
  for (let i = 0; i < 4; i++) {
    const step = niceStep(hi - lo);
    const nextLo = round10(Math.floor(lo / step + 1e-9) * step);
    const nextHi = round10(
      nextLo + Math.ceil((hi - nextLo) / step - 1e-9) * step,
    );
    if (nextLo === lo && nextHi === hi) break;
    lo = nextLo;
    hi = nextHi;
  }
  return [lo, hi];
}

/**
 * Число для подписи шкалы без хвоста плавающей точки: MUI считает значения
 * колец через scale.invert и показывает 29.000000000000007.
 */
export function formatTick(value: number): string {
  const rounded = Number(value.toPrecision(10));
  // «-0» и остатки вида -1e-15 — это нуль, а не число для подписи
  return Math.abs(rounded) < 1e-9 ? "0" : String(rounded);
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

// ---------------------------------------------------------------------------
// Выгрузка графиков для статьи
// ---------------------------------------------------------------------------

/**
 * Печатная ширина рисунка: радар (колонка) и широкий график (страница).
 * Колонка взята 100 мм, а не 84: радар квадратный и в 84 мм превращался в
 * мелкий кружок среди огромных подписей.
 */
export const EXPORT_WIDTH_MM = { column: 100, page: 170 } as const;

/**
 * Кегль подписей на печати: журналы требуют ≥ 12 pt, плюс небольшой запас на
 * усадку при вёрстке. Больше не берём — при 16 pt подписи были вдвое крупнее
 * экранных и забивали рисунок.
 */
export const EXPORT_FONT_PT = 13;

/**
 * Размер шрифта в px исходного узла, при котором на печатной ширине
 * `finalWidthMm` подписи будут не меньше `pt`.
 *
 * Рисунок масштабируется целиком, поэтому кегль считается пропорцией: узел
 * шириной nodeWidthPx будет напечатан шириной finalWidthMm.
 */
export function exportFontPx(
  nodeWidthPx: number,
  finalWidthMm: number,
  pt = EXPORT_FONT_PT,
): number {
  const finalWidthPx = (finalWidthMm / 25.4) * 96;
  return ((pt * 96) / 72) * (nodeWidthPx / finalWidthPx);
}

/**
 * Кегль подписей графиков (px). Один и тот же для экрана и для выгрузки: его
 * считает route из реальной ширины графика (см. exportFontPx), поэтому
 * картинка в файле совпадает с тем, что видно на сайте, — ни пересчёта, ни
 * «выгрузочных» размеров. `null` — ширина ещё не измерена, берётся запасной.
 */
export const ChartFontContext = createContext<number | null>(null);

/** Запасной кегль, пока ширина графика не измерена */
export const DEFAULT_CHART_FONT_PX = 16;

const EXPORT_FONT_FAMILY = '"Times New Roman", Times, serif';

/**
 * Ставит стили для выгрузки прямо на элементы графика и возвращает функцию
 * отката.
 *
 * `html-to-image` переносит в клон только атрибуты и inline-стили самого
 * элемента, а правила из `sx`/CSS в файл не попадают (проверено по SVG:
 * на экране Times New Roman 19px, в файле Roboto 12px и fill-opacity 0.2).
 * Поэтому всё, что должно совпадать с экраном, задаётся здесь inline.
 */
export function inlineChartStyles(
  node: HTMLElement,
  { fontPx }: { fontPx: number },
): () => void {
  const restores: Array<() => void> = [];

  const set = (el: Element, name: string, value: string) => {
    const style = (el as HTMLElement | SVGElement).style;
    const prev = style.getPropertyValue(name);
    const prevPriority = style.getPropertyPriority(name);
    style.setProperty(name, value, "important");
    restores.push(() =>
      prev
        ? style.setProperty(name, prev, prevPriority)
        : style.removeProperty(name),
    );
  };
  const setAttr = (el: Element, name: string, value: string) => {
    const prev = el.getAttribute(name);
    el.setAttribute(name, value);
    restores.push(() =>
      prev === null ? el.removeAttribute(name) : el.setAttribute(name, prev),
    );
  };

  node.querySelectorAll("svg text").forEach((text) => {
    set(text, "font-size", `${fontPx}px`);
    set(text, "font-family", EXPORT_FONT_FAMILY);
    set(text, "fill", "#000");
  });
  // Легенда линейного графика — обычный HTML, а не SVG
  node
    .querySelectorAll(".MuiChartsLegend-root, .MuiChartsLegend-root *")
    .forEach((el) => {
      set(el, "font-size", `${fontPx}px`);
      set(el, "font-family", EXPORT_FONT_FAMILY);
    });
  // Рамка мини-графика — часть экрана: в выгрузке она получалась обрезанной
  // (виден только верхний край), а в статье рамки вокруг панелей не нужны.
  node.querySelectorAll(".export-frameless").forEach((frame) => {
    set(frame, "border", "0");
    set(frame, "box-shadow", "none");
  });
  // Подпись панели («S1») — обычный HTML, поэтому её кегль задаём отдельно
  node.querySelectorAll(".export-caption").forEach((caption) => {
    set(caption, "font-size", `${fontPx}px`);
    set(caption, "font-family", EXPORT_FONT_FAMILY);
    set(caption, "color", "#000");
  });
  // Пунктирные линии min/max — подсказка для работы с графиком, а не часть
  // рисунка: в статье они только мешают подписям.
  node.querySelectorAll(".MuiChartsReferenceLine-root").forEach((line) => {
    set(line, "display", "none");
  });
  // MUI рисует заливку радара атрибутом fill-opacity 0.2, на экране её
  // перебивает sx — в выгрузке нужна та же сплошная заливка
  node.querySelectorAll(".MuiRadarChart-seriesArea").forEach((area) => {
    setAttr(area, "fill-opacity", "1");
  });

  return () => restores.reverse().forEach((restore) => restore());
}
