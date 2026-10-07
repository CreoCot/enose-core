import { ChartsText, useDrawingArea } from "@mui/x-charts";
import { RadarChart } from "@mui/x-charts/RadarChart";
import { useContext, useEffect, useMemo, useRef, useState } from "react";
import SensorList from "./SensorList";
import {
  fingerprintRadii,
  radarArea,
  timeDiagramValues,
  type AreaMode,
} from "../lib/masks";
import {
  ChartFontContext,
  DEFAULT_CHART_FONT_PX,
  formatTick,
  niceCeil,
  niceRange,
  niceStep,
  zoomRadarMax,
} from "../lib/utils";

interface Props {
  maxArray: number[];
  sensorSize: number;
  error: string;
  renderedPlotIds: Record<string, boolean>;
  handleCheckboxClick: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleLessThanTwo: () => void;
  /**
   * "max" — диаграмма максимумов: ось = сенсор, радиус = max|ΔF|.
   * "time" — временная диаграмма MAG-soft: оси = (момент времени × сенсор),
   * радиус = ΔF со знаком. Нужны deltas и times.
   */
  kind?: "max" | "time";
  /** deltas[i][k] — ΔF i-го сенсора в момент times[k]; только для kind="time" */
  deltas?: number[][];
  times?: number[];
}

// Единицы радиальной шкалы. Рисуется внутри SVG, чтобы попасть в выгрузку.
const ScaleUnit = ({ fontSize }: { fontSize: number }) => {
  const { left, top } = useDrawingArea();
  return (
    <ChartsText
      x={left + 4}
      y={top + fontSize}
      text="ΔF, Гц"
      style={{ fontSize, textAnchor: "start" }}
    />
  );
};

// Подписи колец вдоль вертикальной оси (она у радара всегда идёт вверх).
// Свои, а не RadarAxis: тот берёт значения из scale.invert и показывает
// 29.000000000000007, а формат для радиальной оси в MUI задать нельзя.
const RingScale = ({
  min,
  max,
  rings,
  fontSize,
}: {
  min: number;
  max: number;
  rings: number;
  fontSize: number;
}) => {
  const { left, top, width, height } = useDrawingArea();
  const cx = left + width / 2;
  const cy = top + height / 2;
  const radius = Math.min(width, height) / 2;
  return (
    <g>
      {Array.from({ length: rings }, (_, k) => {
        const fraction = (k + 1) / rings;
        return (
          <ChartsText
            key={k}
            // справа от вертикальной линии, сразу под своим кольцом: над внешним
            // кольцом стоит подпись оси («0 с»), и числа бы с ней слипались
            x={cx + fontSize * 0.25}
            y={cy - radius * fraction + fontSize * 0.95}
            text={formatTick(min + (max - min) * fraction)}
            style={{
              fontSize,
              textAnchor: "start",
              // белая обводка, чтобы цифры читались поверх заливки
              stroke: "#fff",
              strokeWidth: fontSize * 0.2,
              paintOrder: "stroke",
            }}
          />
        );
      })}
    </g>
  );
};

const MAX_RINGS = 20;
const round2 = (v: number) => Number(v.toFixed(2));
const zoomButton =
  "flex h-[40px] w-[40px] shrink-0 items-center justify-center rounded-full bg-primary-200 text-primary-600 text-xl font-semibold leading-none border-2 border-primary-400 hover:bg-primary-300 cursor-pointer transition-colors duration-300";

// Числовое поле с буфером: значение применяется по Enter или уходу фокуса, а
// не на каждый символ (иначе «-» или «5.» в процессе набора сбрасывали бы
// поле). Пустое поле у «Шаг» означает автоподбор.
const NumberField = ({
  label,
  value,
  placeholder,
  onCommit,
}: {
  label: string;
  value: number | null;
  placeholder?: string;
  onCommit: (value: number) => void;
}) => {
  const [text, setText] = useState(value === null ? "" : String(value));
  useEffect(() => setText(value === null ? "" : String(value)), [value]);
  const commit = () => {
    const parsed = text.trim() === "" ? 0 : Number(text.replace(",", "."));
    if (Number.isFinite(parsed)) onCommit(parsed);
    else setText(value === null ? "" : String(value));
  };
  return (
    <label className="flex flex-col gap-1 text-primary-700 text-base">
      {label}
      <input
        type="text"
        inputMode="decimal"
        value={text}
        placeholder={placeholder}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
        className="w-full min-w-0 rounded-[10px] border border-primary-300 px-2 py-1 text-primary-600 text-lg"
      />
    </label>
  );
};

const MaxRadar = ({
  maxArray,
  sensorSize,
  error,
  renderedPlotIds,
  handleCheckboxClick,
  handleLessThanTwo,
  kind = "max",
  deltas = [],
  times = [],
}: Props) => {
  const isTime = kind === "time";
  // Кегль общий для экрана и выгрузки (см. ChartFontContext)
  const fontPx = useContext(ChartFontContext) ?? DEFAULT_CHART_FONT_PX;
  const [areaMode, setAreaMode] = useState<AreaMode>(isTime ? "signed" : "abs");
  // Сетка по умолчанию только на временных метках: спица на каждый сенсор
  // при 8 сенсорах даёт в 8 раз больше линий и забивает диаграмму.
  const [sensorGrid, setSensorGrid] = useState(false);
  const chartRef = useRef<HTMLDivElement>(null);
  const visibleSensors = Object.entries(renderedPlotIds)
    .filter(([_, v]) => v === true)
    .map(([k]) => Number(k));

  // Радиусы осей: у диаграммы максимумов это max|ΔF| по сенсорам, у временной —
  // ΔF со знаком, развёрнутые time-major (ось = момент времени × сенсор).
  const renderedArray = useMemo(() => {
    if (!isTime) {
      return visibleSensors.map((i) =>
        typeof maxArray[i] === "number" ? maxArray[i] : 0,
      );
    }
    return timeDiagramValues(visibleSensors.map((i) => deltas[i] ?? []));
  }, [isTime, maxArray, deltas, renderedPlotIds]);

  // Подписи осей. У временной диаграммы MAG-soft подписывает только первую ось
  // каждой временной группы, иначе 2400 подписей сливаются в кашу; полное имя
  // остаётся в тултипе.
  const axisNames = useMemo(() => {
    if (!isTime) {
      return visibleSensors.map((i) => `S${i + 1}`);
    }
    const n = visibleSensors.length;
    return renderedArray.map((_, j) => {
      const t = times[Math.floor(j / n)];
      return `S${visibleSensors[j % n] + 1} · ${t ?? "?"} с`;
    });
  }, [isTime, renderedArray, times, renderedPlotIds]);

  // Границы оси — круглые и кратные шагу колец, иначе подписи получаются
  // вроде −31, −11, 9, 29. У диаграммы максимумов нижняя граница — ноль.
  const [autoMin, initialPlotMax] = isTime
    ? niceRange(
        Math.min(...renderedArray, 0),
        Math.max(0, ...renderedArray.filter(Number.isFinite)),
      )
    : [0, niceCeil(0, Math.max(1, ...renderedArray.filter(Number.isFinite)))];
  const [plotMin, setPlotMin] = useState(autoMin);
  const [plotMax, setPlotMax] = useState(initialPlotMax);
  // null — шаг подбирается автоматически (всегда целый)
  const [stepOverride, setStepOverride] = useState<number | null>(null);
  const plotColor = "#4b4bc3";

  // Сетка строится от шага: границы оси подтягиваются к кратным ему значениям,
  // и каждое кольцо получает круглую подпись, а не 58 / 3 = 19.3333.
  const span = plotMax - plotMin;
  const autoStep = niceStep(span);
  let step = stepOverride ?? autoStep;
  if (span / step > MAX_RINGS) step = niceStep(span, MAX_RINGS);
  const axisMin = round2(Math.floor(plotMin / step + 1e-9) * step);
  const rings = Math.max(1, Math.ceil((plotMax - axisMin) / step - 1e-9));
  const axisMax = round2(axisMin + rings * step);
  useEffect(() => {
    const activeCount = Object.values(renderedPlotIds).filter(Boolean).length;
    if (activeCount <= 2) {
      handleLessThanTwo();
    }
  }, [renderedPlotIds, handleLessThanTwo]);

  // Площадь по формуле MAG-soft. В режиме «со знаком» радиусы отсчитываются от
  // минимума оси (AxeMinVal), в режиме «по модулю» — от нуля.
  const area = radarArea(
    fingerprintRadii(renderedArray, areaMode, areaMode === "abs" ? 0 : axisMin),
  );

  // Спицы сетки идут по одной на ось (time-major), поэтому «только временные
  // метки» — это каждая N-я, где N — число показанных сенсоров.
  //
  // Прячем их атрибутом на самом элементе, а не стилем: CSS-правило из sx не
  // попадает в клон при выгрузке в PNG/SVG, и экспорт расходился бы с экраном.
  // MUI перерисовывает сетку после замера размеров и возвращает свою
  // прозрачность, поэтому следим за поддеревом и применяем заново.
  useEffect(() => {
    const root = chartRef.current;
    if (!root) return;
    const n = visibleSensors.length;

    const apply = () => {
      root
        .querySelectorAll<SVGPathElement>(".MuiRadarChart-gridRadial")
        .forEach((spoke, i) => {
          const hidden = isTime && !sensorGrid && n > 1 && i % n !== 0;
          const want = hidden ? "0" : "0.3";
          if (spoke.getAttribute("stroke-opacity") !== want) {
            spoke.setAttribute("stroke-opacity", want);
          }
        });
    };

    apply();
    const observer = new MutationObserver(apply);
    observer.observe(root, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [isTime, sensorGrid, renderedArray.length, renderedPlotIds]);

  const metrics = useMemo(
    () =>
      axisNames.map((name) => ({
        name,
        min: axisMin,
        max: axisMax,
      })),
    [axisMax, axisMin, axisNames],
  );

  // Подписи делений на самой окружности. Оси и площадь считаются по всем
  // точкам, но подписываем только первый сенсор временной группы и не чаще
  // MAX_TICKS раз по кругу: без маски групп бывает 300+, и подписи сливаются
  // в сплошное кольцо. Полное имя оси остаётся в тултипе.
  const MAX_TICKS = 12;
  const tickByName = useMemo(() => {
    const map: Record<string, string> = {};
    const n = visibleSensors.length;
    if (!isTime || n === 0) return map;
    const groups = Math.ceil(renderedArray.length / n);
    const step = Math.max(1, Math.ceil(groups / MAX_TICKS));
    axisNames.forEach((name, j) => {
      const group = Math.floor(j / n);
      map[name] =
        j % n === 0 && group % step === 0 ? `${times[group] ?? "?"} с` : "";
    });
    return map;
  }, [isTime, axisNames, renderedArray, times]);
  return (
    <>
      {error.length !== 0 && (
        <div className="text-primary-700 font-bold text-2xl lg:text-3xl mx-8 my-4">
          {error}
        </div>
      )}

      {error.length === 0 && (
        <div className="flex md:mx-8 my-4 bg-grey-100 lg:py-5 px-4 md:px-5 2xl:px-6 rounded-[10px] shadow-md shadow-primary-200 border border-primary-300">
          <SensorList
            renderedPlotIds={renderedPlotIds}
            handleCheckboxClick={handleCheckboxClick}
          />
          <div ref={chartRef} className="contents">
            <RadarChart
              key={metrics.length}
              colors={[plotColor]}
              className="download-image mx-8 my-4 rounded-[10px] shadow-sm shadow-primary-200 border-2 border-primary-200"
              height={640}
              skipAnimation={isTime}
              // Классический вид: круглая сетка и никаких серых полос
              shape="circular"
              stripeColor={null}
              // Поля под подписи пропорциональны кеглю: «300 с» шире, чем «S3»,
              // а без запаса крайние подписи обрезаются
              margin={{
                left: Math.ceil(fontPx * (isTime ? 3.4 : 2.4)),
                right: Math.ceil(fontPx * (isTime ? 3.4 : 2.4)),
                top: Math.ceil(fontPx * 1.8),
                bottom: Math.ceil(fontPx * 1.8),
              }}
              divisions={rings}
              sx={{
                "& text": {
                  fontFamily: '"Times New Roman", Times, serif !important',
                  fontSize: `${fontPx}px !important`,
                },
                "& .MuiRadarChart-seriesArea": { fillOpacity: 1 },
              }}
              series={[
                { data: renderedArray, fillArea: true, hideMark: isTime },
              ]}
              radar={{
                max: axisMax,
                metrics: metrics,
                // На окружности подписываем только первый сенсор каждой
                // временной группы (как в MAG-soft), в тултипе — полное имя.
                labelFormatter: (name, { location }) =>
                  !isTime || location === "tooltip"
                    ? name
                    : tickByName[name] ?? "",
              }}
            >
              <RingScale
                min={axisMin}
                max={axisMax}
                rings={rings}
                fontSize={fontPx}
              />
              <ScaleUnit fontSize={fontPx} />
            </RadarChart>
          </div>
          <div className="flex flex-col justify-start p-5 h-full">
            <div className="flex w-64 flex-col gap-4 rounded-[10px] border-2 border-primary-200 p-5 shadow-sm shadow-primary-200">
              <p className="text-primary-800 font-semibold text-2xl">Масштаб</p>
              <div className="grid grid-cols-3 gap-2">
                <NumberField
                  label="Мин"
                  value={axisMin}
                  onCommit={(v) => v < plotMax && setPlotMin(round2(v))}
                />
                <NumberField
                  label="Макс"
                  value={axisMax}
                  onCommit={(v) => v > plotMin && setPlotMax(round2(v))}
                />
                <NumberField
                  label="Шаг"
                  value={stepOverride}
                  placeholder={String(step)}
                  onCommit={(v) => setStepOverride(v > 0 ? round2(v) : null)}
                />
              </div>
              <p className="text-primary-600 text-sm -mt-2">
                {stepOverride === null
                  ? "шаг подобран автоматически"
                  : "шаг задан вручную"}
                {" · "}колец: {rings}
              </p>
              <div className="flex items-center gap-2">
                <span className="text-primary-700 text-lg grow">Масштаб</span>
                <button
                  type="button"
                  title="Отдалить"
                  onClick={() =>
                    setPlotMax(
                      stepOverride === null
                        ? zoomRadarMax(axisMin, axisMax, "out")
                        : axisMax + step,
                    )
                  }
                  className={zoomButton}
                >
                  −
                </button>
                <button
                  type="button"
                  title="Приблизить"
                  onClick={() =>
                    setPlotMax(
                      stepOverride === null
                        ? zoomRadarMax(axisMin, axisMax, "in")
                        : Math.max(axisMax - step, axisMin + step),
                    )
                  }
                  className={zoomButton}
                >
                  +
                </button>
              </div>
              <button
                type="button"
                onClick={() => {
                  setPlotMin(autoMin);
                  setPlotMax(initialPlotMax);
                  setStepOverride(null);
                }}
                className="rounded-full bg-accent-200 px-4 py-1.5 text-accent-600 font-semibold border border-accent-500 hover:bg-accent-300 cursor-pointer transition-colors duration-300"
              >
                Авто
              </button>
            </div>
            <div className="mt-5 flex flex-col gap-3 rounded-[10px] border-2 border-primary-200 p-6 shadow-sm shadow-primary-200">
              <p className="text-primary-800 font-semibold text-2xl">Площадь</p>
              <p className="text-primary-700 text-xl">{area.toFixed(2)} Гц²</p>
              <div className="flex flex-col gap-2 text-primary-700 text-lg">
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="radio"
                    name={`area-mode-${kind}`}
                    checked={areaMode === "abs"}
                    onChange={() => setAreaMode("abs")}
                  />
                  по модулю |ΔF|
                </label>
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="radio"
                    name={`area-mode-${kind}`}
                    checked={areaMode === "signed"}
                    onChange={() => setAreaMode("signed")}
                  />
                  со знаком ΔF
                </label>
              </div>
              {isTime && (
                <label className="flex cursor-pointer items-center gap-2 text-primary-700 text-lg">
                  <input
                    type="checkbox"
                    checked={sensorGrid}
                    onChange={(e) => setSensorGrid(e.target.checked)}
                  />
                  сетка по сенсорам
                </label>
              )}
              <p className="text-primary-600 text-base">
                Осей: {renderedArray.length}
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default MaxRadar;
