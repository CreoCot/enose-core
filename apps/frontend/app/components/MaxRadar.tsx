import { ChartsText, useDrawingArea } from "@mui/x-charts";
import { RadarAxis, RadarChart } from "@mui/x-charts/RadarChart";
import { useContext, useEffect, useMemo, useRef, useState } from "react";
import SensorList from "./SensorList";
import {
  fingerprintRadii,
  radarArea,
  timeDiagramValues,
  type AreaMode,
} from "../lib/masks";
import {
  ExportFontContext,
  niceCeil,
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
  const exportFont = useContext(ExportFontContext);
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

  const autoMin = isTime
    ? Math.min(0, Math.floor(Math.min(...renderedArray, 0)))
    : 0;
  const globalMax = Math.max(autoMin, ...renderedArray.filter(Number.isFinite));
  // Округляем верх оси до «красивого» значения, чтобы подписи делений
  // оставались круглыми (иначе после зума получаются дроби вида 30.5785…)
  const initialPlotMax = niceCeil(autoMin, Math.max(globalMax, autoMin + 1));
  const [plotMin, setPlotMin] = useState(autoMin);
  const [plotMax, setPlotMax] = useState(initialPlotMax);
  const plotColor = "#4b4bc3";
  useEffect(() => {
    const activeCount = Object.values(renderedPlotIds).filter(Boolean).length;
    if (activeCount <= 2) {
      handleLessThanTwo();
    }
  }, [renderedPlotIds, handleLessThanTwo]);

  // Площадь по формуле MAG-soft. В режиме «со знаком» радиусы отсчитываются от
  // минимума оси (AxeMinVal), в режиме «по модулю» — от нуля.
  const area = radarArea(
    fingerprintRadii(renderedArray, areaMode, areaMode === "abs" ? 0 : plotMin),
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

  // Кольца: ось заканчивается на кратном шагу значении (см. niceCeil), поэтому
  // число колец равно числу шагов и каждое кольцо подписано круглым числом.
  const range = plotMax - plotMin;
  const rings = Math.max(1, Math.round(range / niceStep(range)));
  const fontPx = isTime ? 16 : 22;
  // Шкалу ставим между осями, чтобы подписи колец не наезжали на подписи самих
  // осей. У временной диаграммы подписано ~12 направлений через 30°, поэтому
  // шкала идёт по биссектрисе первого промежутка; у диаграммы максимумов — по
  // биссектрисе между первыми двумя осями.
  const scaleAngle = isTime ? 15 : 180 / Math.max(1, axisNames.length);

  const metrics = useMemo(
    () =>
      axisNames.map((name) => ({
        name,
        min: plotMin,
        max: plotMax,
      })),
    [plotMax, plotMin, axisNames],
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
              // Крупный шрифт выгрузки не помещается в стандартные поля —
              // боковые подписи («S3», «S7») обрезались бы
              margin={
                exportFont
                  ? {
                      // «300 с» шире, чем «S3»: боковые поля подбираем под
                      // самую длинную подпись, иначе её обрежет
                      left: Math.ceil(exportFont * (isTime ? 3.4 : 2.4)),
                      right: Math.ceil(exportFont * (isTime ? 3.4 : 2.4)),
                      top: Math.ceil(exportFont * 1.8),
                      bottom: Math.ceil(exportFont * 1.8),
                    }
                  : undefined
              }
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
                max: plotMax,
                metrics: metrics,
                // На окружности подписываем только первый сенсор каждой
                // временной группы (как в MAG-soft), в тултипе — полное имя.
                labelFormatter: (name, { location }) =>
                  !isTime || location === "tooltip"
                    ? name
                    : tickByName[name] ?? "",
              }}
            >
              {/* Шкала по радиусу: подписи колец ставим между осями, чтобы они
                  не наезжали на подписи самих осей */}
              {metrics.length > 0 && (
                <RadarAxis
                  metric={metrics[0].name}
                  divisions={rings}
                  labelOrientation="horizontal"
                  angle={scaleAngle}
                />
              )}
              <ScaleUnit fontSize={fontPx} />
            </RadarChart>
          </div>
          <div className="flex flex-col justify-start p-5 h-full">
            <div className="flex flex-col p-6 gap-5 border-2 border-primary-200 rounded-[10px] shadow-sm shadow-primary-200">
              <p className="text-primary-800 font-semibold text-2xl">Масштаб</p>
              <div className="flex flex-col gap-3">
                <label className="flex flex-col gap-2 text-primary-700 text-xl">
                  Минимум
                  <input
                    type="number"
                    max={plotMax}
                    step="any"
                    value={plotMin}
                    onChange={(event) => {
                      const value = Number(event.target.value);
                      // Минимум может быть отрицательным: на временной
                      // диаграмме ΔF со знаком уходит ниже нуля.
                      if (Number.isFinite(value) && value < plotMax) {
                        setPlotMin(value);
                      }
                    }}
                    className="w-10 border border-primary-300 rounded-[10px] px-3 py-1 text-primary-600 text-lg"
                  />
                </label>
                <label className="flex flex-col gap-2 text-primary-700 text-xl">
                  Максимум
                  <input
                    type="number"
                    min={plotMin}
                    step="any"
                    value={plotMax}
                    onChange={(event) => {
                      const value = Number(event.target.value);
                      if (Number.isFinite(value) && value > plotMin) {
                        setPlotMax(value);
                      }
                    }}
                    className="w-20 border border-primary-300 rounded-[10px] px-3 py-1 text-primary-600 text-lg"
                  />
                </label>
              </div>
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setPlotMax((m) => zoomRadarMax(plotMin, m, "in"))
                  }
                  className="rounded-full bg-primary-200 px-4 py-1.5 text-primary-500 font-semibold border-2 border-primary-400 hover:bg-primary-300 cursor-pointer transition-colors duration-300"
                >
                  Приблизить
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setPlotMax((m) => zoomRadarMax(plotMin, m, "out"))
                  }
                  className="rounded-full bg-primary-200 px-4 py-1.5 text-primary-500 font-semibold border-2 border-primary-400 hover:bg-primary-300 cursor-pointer transition-colors duration-300"
                >
                  Отдалить
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPlotMin(0);
                    setPlotMax(initialPlotMax);
                  }}
                  className="rounded-full bg-accent-200 px-4 py-1.5 text-accent-600 font-semibold border border-accent-500 hover:bg-accent-300 cursor-pointer transition-colors duration-300"
                >
                  Авто
                </button>
              </div>
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
