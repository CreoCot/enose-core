import { useEffect, useRef, useState } from "react";
import { toPng, toSvg } from "html-to-image";
import MultiPlot from "./MultiPlot";
import Plots from "./Plots";
import MaxRadar from "./MaxRadar";
import { maxDiagramValues, timeDiagramValues } from "../lib/masks";
import {
  autoTimeRange,
  ChartFontContext,
  EXPORT_WIDTH_MM,
  exportFontPx,
  inlineChartStyles,
} from "../lib/utils";

// 300 dpi при 96 css-dpi: столько просят в требованиях к иллюстрациям
// большинства журналов (растровые рисунки — не ниже 300 dpi).
export const EXPORT_PIXEL_RATIO = 300 / 96;

// Кнопки управления графиком — часть интерфейса, а не рисунка
const exportFilter = (node: HTMLElement) =>
  !(node instanceof HTMLElement) || !node.classList.contains("no-export");

/**
 * Снимает график в PNG (300 dpi) или SVG. Общая для кнопок «Скачать» и для
 * отчёта: картинка в PDF получается ровно той же, что и скачанная вручную.
 */
export async function renderChart(
  target: HTMLElement,
  fontPx: number,
  format: "png" | "svg",
): Promise<string> {
  // Берём реальный бокс элемента и гасим его внешние отступы: с mx-8/my-4
  // html-to-image сдвигал клон на величину отступа, из-за чего картинка
  // съезжала вправо и обрезались подписи крайних осей.
  const rect = target.getBoundingClientRect();
  // Размеры подписей на экране уже заданы этим же кеглем, но правила из
  // sx в клон не попадают — дублируем их inline на время съёмки.
  const restoreStyles = inlineChartStyles(target, { fontPx });
  try {
    const options = {
      backgroundColor: "#FFFFFF",
      width: Math.ceil(rect.width),
      height: Math.ceil(rect.height),
      style: { margin: "0" },
      filter: exportFilter,
    };
    return format === "png"
      ? await toPng(target, { ...options, pixelRatio: EXPORT_PIXEL_RATIO })
      : await toSvg(target, options);
  } finally {
    restoreStyles();
  }
}

export type FigureKey = "compare" | "plots" | "max_radar" | "time_radar";

export interface CaptureResult {
  images: Partial<Record<FigureKey, Blob>>;
  /** Минимум шкалы временной диаграммы на рисунке (входит в формулу площади) */
  timeAxisMin: number | null;
  /** Индексы показанных сенсоров (с нуля) */
  sensors: number[];
}

interface Props {
  plots: number[][];
  timestamps: number[];
  sensorSize: number;
  renderedPlotIds: Record<string, boolean>;
  onResult: (result: CaptureResult) => void;
  onError: (message: string) => void;
}

const FIGURES: { key: FigureKey; mm: number }[] = [
  { key: "compare", mm: EXPORT_WIDTH_MM.page },
  { key: "plots", mm: EXPORT_WIDTH_MM.page },
  { key: "max_radar", mm: EXPORT_WIDTH_MM.column },
  { key: "time_radar", mm: EXPORT_WIDTH_MM.column },
];

// Ширина «виртуального экрана», на котором рисуются графики для отчёта:
// как на обычном десктопе, чтобы раскладка совпадала с экранной.
const CAPTURE_WIDTH_PX = 1500;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const noop = () => {};

/**
 * Рисует четыре графика за кадром (с выбранной маской и показанными
 * сенсорами, масштаб радаров — автоматический) и снимает их для PDF-отчёта.
 * Вкладки сайта при этом не переключаются и ручной масштаб не сбрасывается.
 */
const ReportCapture = ({
  plots,
  timestamps,
  sensorSize,
  renderedPlotIds,
  onResult,
  onError,
}: Props) => {
  const root = useRef<HTMLDivElement>(null);
  const [fonts, setFonts] = useState<Partial<Record<FigureKey, number>>>({});
  const started = useRef(false);

  const sensors = Object.entries(renderedPlotIds)
    .filter(([, shown]) => shown)
    .map(([i]) => Number(i))
    .sort((a, b) => a - b);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const nodeOf = (key: FigureKey) =>
      root.current?.querySelector<HTMLElement>(
        `[data-figure="${key}"] .download-image`,
      ) ?? null;

    (async () => {
      try {
        // 1. Раскладка → ширины графиков → кегль под печатную ширину
        await sleep(500);
        const next: Partial<Record<FigureKey, number>> = {};
        for (const { key, mm } of FIGURES) {
          const node = nodeOf(key);
          const width = node?.getBoundingClientRect().width ?? 0;
          if (!node || width <= 0)
            throw new Error(`Не удалось построить ${key}`);
          next[key] = exportFontPx(width, mm);
        }
        setFonts(next);

        // 2. Перерисовка с новым кеглем, шрифты и анимации графиков
        await sleep(1800);
        await document.fonts?.ready;

        // 3. Снимки
        const images: CaptureResult["images"] = {};
        for (const { key } of FIGURES) {
          const node = nodeOf(key);
          if (!node) throw new Error(`График ${key} не найден`);
          const dataUrl = await renderChart(node, next[key]!, "png");
          images[key] = await (await fetch(dataUrl)).blob();
        }

        // Минимум шкалы временной диаграммы — тот же расчёт, что у MaxRadar
        const shown = sensors.map((i) => plots[i] ?? []);
        const timeValues = timeDiagramValues(shown);
        onResult({
          images,
          timeAxisMin: timeValues.length ? autoTimeRange(timeValues)[0] : null,
          sensors,
        });
      } catch (e) {
        onError(e instanceof Error ? e.message : "Не удалось снять графики");
      }
    })();
  }, []);

  const common = {
    sensorSize,
    error: "",
    renderedPlotIds,
    handleCheckboxClick: noop,
  };

  return (
    <div
      ref={root}
      aria-hidden
      // За кадром, но в раскладке: display:none дал бы графикам нулевую ширину
      style={{
        position: "fixed",
        left: -20000,
        top: 0,
        width: CAPTURE_WIDTH_PX,
        background: "#fff",
        pointerEvents: "none",
      }}
    >
      <div data-figure="compare">
        <ChartFontContext.Provider value={fonts.compare ?? null}>
          <MultiPlot {...common} timestamps={timestamps} sensorData={plots} />
        </ChartFontContext.Provider>
      </div>
      <div data-figure="plots">
        <ChartFontContext.Provider value={fonts.plots ?? null}>
          <Plots {...common} timestamps={timestamps} data={plots} />
        </ChartFontContext.Provider>
      </div>
      <div data-figure="max_radar">
        <ChartFontContext.Provider value={fonts.max_radar ?? null}>
          <MaxRadar
            {...common}
            maxArray={maxDiagramValues(plots)}
            handleLessThanTwo={noop}
          />
        </ChartFontContext.Provider>
      </div>
      <div data-figure="time_radar">
        <ChartFontContext.Provider value={fonts.time_radar ?? null}>
          <MaxRadar
            {...common}
            kind="time"
            maxArray={[]}
            deltas={plots}
            times={timestamps}
            handleLessThanTwo={noop}
          />
        </ChartFontContext.Provider>
      </div>
    </div>
  );
};

export default ReportCapture;
