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
  const drag = useRef(false);

  const local = (e: React.PointerEvent<SVGRectElement>) => {
    const svg = e.currentTarget.ownerSVGElement;
    const box = (svg ?? e.currentTarget).getBoundingClientRect();
    return {
      x: Math.min(Math.max(e.clientX - box.left, left), left + width),
      y: Math.min(Math.max(e.clientY - box.top, top), top + height),
    };
  };

  const onDown = (e: React.PointerEvent<SVGRectElement>) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = local(e);
    drag.current = true;
    setSel({
      x0: p.x,
      y0: autoY ? top : p.y,
      x1: p.x,
      y1: autoY ? top + height : p.y,
    });
  };

  const onMove = (e: React.PointerEvent<SVGRectElement>) => {
    if (!drag.current) return;
    const p = local(e);
    setSel((s) => (s ? { ...s, x1: p.x, y1: autoY ? top + height : p.y } : s));
  };

  const onUp = (e: React.PointerEvent<SVGRectElement>) => {
    if (!drag.current || !sel) return;
    drag.current = false;
    e.currentTarget.releasePointerCapture(e.pointerId);
    const done = sel;
    setSel(null);

    const wide = Math.abs(done.x1 - done.x0) > MIN_SELECTION_PX;
    const tall = autoY || Math.abs(done.y1 - done.y0) > MIN_SELECTION_PX;
    if (!wide || !tall) return;

    const x = normalizeRange(xScale.invert(done.x0), xScale.invert(done.x1));
    const y = autoY
      ? null
      : normalizeRange(yScale.invert(done.y0), yScale.invert(done.y1));
    onZoom(x, y);
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
        onPointerMove={onMove}
        onPointerUp={onUp}
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
