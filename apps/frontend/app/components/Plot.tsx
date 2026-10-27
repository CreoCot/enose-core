import { useContext, useMemo } from "react";
import ZoomableChart from "./ZoomableChart";
import { ChartFontContext, DEFAULT_CHART_FONT_PX } from "../lib/utils";

interface Props {
  id: number;
  timestamps: number[];
  sensorData: number[];
}

const plotColor = "#7B3BCE"; // accent-500

const Plot = ({ id, timestamps, sensorData }: Props) => {
  // Подпись панели — тем же кеглем, что и подписи графика, как и в выгрузке
  const fontPx = useContext(ChartFontContext) ?? DEFAULT_CHART_FONT_PX;
  const series = useMemo(
    () => [{ id: `sensor-${id}`, label: `S${id + 1}`, data: sensorData }],
    [id, sensorData],
  );
  return (
    <div className="flex flex-col gap-3 w-full h-full">
      <ZoomableChart
        className="export-frameless rounded-[10px] shadow-sm shadow-accent-300 border border-accent-300"
        timestamps={timestamps}
        series={series}
        colors={[plotColor]}
        height={380}
        hideLegend
        compact
      />
      <p
        className="export-caption font-medium text-center text-accent-900"
        style={{ fontSize: fontPx }}
      >
        S{id + 1}
      </p>
    </div>
  );
};
export default Plot;
