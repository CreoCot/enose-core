import { useMemo, useRef, useState } from "react";
import {
  ChartsReferenceLine,
  LineChart,
  useDrawingArea,
  useXScale,
  useYScale,
} from "@mui/x-charts";
import {
  MIN_SELECTION_PX,
  fullXRange,
  normalizeRange,
  padRange,
  visibleExtent,
  type Range,
} from "../lib/zoom";

export interface ChartSeries {
  id: string;
  label: string;
  data: number[];
}

interface Props {
  timestamps: number[];
  series: ChartSeries[];
  colors: string[];
  height: number;
  className?: string;
  hideLegend?: boolean;
}

interface Selection {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

interface OverlayProps {
  autoY: boolean;
  onZoom: (x: Range, y: Range | null) => void;
  onReset: () => void;
}

// Прозрачный слой поверх области графика: выделение прямоугольника мышью
// (как в MAG-soft). При включённом автомасштабе Y выделяется только диапазон
// по X. Двойной клик — сброс.
const SelectionOverlay = ({ autoY, onZoom, onReset }: OverlayProps) => {
  const { left, top, width, height } = useDrawingArea();
  const xScale = useXScale<"linear">();
  const yScale = useYScale<"linear">();
  const [sel, setSel] = useState<Selection | null>(null);
  const selRef = useRef<Selection | null>(null);

  const update = (next: Selection | null) => {
    selRef.current = next;
    setSel(next);
  };

  const onDown = (e: React.PointerEvent<SVGRectElement>) => {
    if (e.button !== 0) return;
    const svg = e.currentTarget.ownerSVGElement;
    if (!svg) return;

    const toLocal = (clientX: number, clientY: number) => {
      const box = svg.getBoundingClientRect();
      return {
        x: Math.min(Math.max(clientX - box.left, left), left + width),
        y: Math.min(Math.max(clientY - box.top, top), top + height),
      };
    };
    const yTop = top;
    const yBottom = top + height;

    const start = toLocal(e.clientX, e.clientY);
    update({
      x0: start.x,
      y0: autoY ? yTop : start.y,
      x1: start.x,
      y1: autoY ? yBottom : start.y,
    });

    // Слушатели на window: выделение продолжается и заканчивается, даже если
    // курсор ушёл за пределы графика.
    const move = (ev: PointerEvent) => {
      const p = toLocal(ev.clientX, ev.clientY);
      const cur = selRef.current;
      if (cur) update({ ...cur, x1: p.x, y1: autoY ? yBottom : p.y });
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      const done = selRef.current;
      update(null);
      if (!done) return;

      const wide = Math.abs(done.x1 - done.x0) > MIN_SELECTION_PX;
      const tall = autoY || Math.abs(done.y1 - done.y0) > MIN_SELECTION_PX;
      if (!wide || !tall) return;

      const x = normalizeRange(xScale.invert(done.x0), xScale.invert(done.x1));
      const y = autoY
        ? null
        : normalizeRange(yScale.invert(done.y0), yScale.invert(done.y1));
      onZoom(x, y);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  };

  return (
    <g>
      <rect
        x={left}
        y={top}
        width={width}
        height={height}
        fill="transparent"
        style={{ cursor: "crosshair", touchAction: "none" }}
        onPointerDown={onDown}
        onDoubleClick={onReset}
      />
      {sel && (
        <rect
          x={Math.min(sel.x0, sel.x1)}
          y={Math.min(sel.y0, sel.y1)}
          width={Math.abs(sel.x1 - sel.x0)}
          height={Math.abs(sel.y1 - sel.y0)}
          fill="rgba(123, 59, 206, 0.15)"
          stroke="#7B3BCE"
          strokeDasharray="4 3"
          pointerEvents="none"
        />
      )}
    </g>
  );
};

const RED = "#dc2626";

const ZoomableChart = ({
  timestamps,
  series,
  colors,
  height,
  className,
  hideLegend,
}: Props) => {
  const [xRange, setXRange] = useState<Range | null>(null);
  const [yRange, setYRange] = useState<Range | null>(null);
  const [autoY, setAutoY] = useState(true);

  const data = useMemo(() => series.map((s) => s.data), [series]);
  const zoomed = xRange !== null || yRange !== null;

  const xDomain = xRange ?? fullXRange(timestamps);
  const extent = useMemo(
    () => visibleExtent(timestamps, data, xRange),
    [timestamps, data, xRange],
  );
  const yDomain: Range | undefined =
    !autoY && yRange ? yRange : extent ? padRange(extent) : undefined;

  const reset = () => {
    setXRange(null);
    setYRange(null);
  };

  const toggleAutoY = (checked: boolean) => {
    setAutoY(checked);
    if (checked) setYRange(null);
  };

  return (
    <div className={className}>
      <div
        className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-3 pt-2 text-sm text-grey-700"
        title="Выделите область мышью для приближения, двойной клик — сброс"
      >
        <label className="flex items-center gap-1.5 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={autoY}
            onChange={(e) => toggleAutoY(e.target.checked)}
          />
          Авто Y
        </label>
        <button
          type="button"
          onClick={reset}
          disabled={!zoomed}
          className="rounded-full bg-accent-100 px-3 py-0.5 text-accent-800 transition-colors hover:bg-accent-200 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Сброс
        </button>
      </div>
      <p className="px-3 text-xs text-grey-600">
        Тяните мышью по графику, чтобы приблизить
      </p>
      <LineChart
        className="-ml-3 -mb-3 -mr-1"
        colors={colors}
        xAxis={[
          {
            data: timestamps,
            scaleType: "linear",
            min: xDomain[0],
            max: xDomain[1],
          },
        ]}
        yAxis={[yDomain ? { min: yDomain[0], max: yDomain[1] } : {}]}
        series={series.map((s) => ({
          id: s.id,
          data: s.data,
          label: s.label,
          showMark: false,
          curve: "linear",
        }))}
        hideLegend={hideLegend}
        height={height}
      >
        {extent && (
          <>
            <ChartsReferenceLine
              y={extent[0]}
              label={`min ${extent[0].toFixed(1)}`}
              labelAlign="start"
              lineStyle={{
                stroke: RED,
                strokeDasharray: "4 3",
                strokeWidth: 1,
              }}
              labelStyle={{ fill: RED, fontSize: 11 }}
            />
            <ChartsReferenceLine
              y={extent[1]}
              label={`max ${extent[1].toFixed(1)}`}
              labelAlign="start"
              lineStyle={{
                stroke: RED,
                strokeDasharray: "4 3",
                strokeWidth: 1,
              }}
              labelStyle={{ fill: RED, fontSize: 11 }}
            />
          </>
        )}
        <SelectionOverlay
          autoY={autoY}
          onReset={reset}
          onZoom={(x, y) => {
            setXRange(x);
            setYRange(y);
          }}
        />
      </LineChart>
    </div>
  );
};

export default ZoomableChart;
