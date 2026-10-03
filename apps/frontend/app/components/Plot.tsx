import { useMemo } from "react";
import ZoomableChart from "./ZoomableChart";

interface Props {
  id: number;
  timestamps: number[];
  sensorData: number[];
}

const plotColor = "#7B3BCE"; // accent-500

const Plot = ({ id, timestamps, sensorData }: Props) => {
  const series = useMemo(
    () => [{ id: `sensor-${id}`, label: `Сенсор ${id + 1}`, data: sensorData }],
    [id, sensorData],
  );
  return (
    <div className="flex flex-col gap-3 w-full h-full">
      <ZoomableChart
        className="rounded-[10px] shadow-sm shadow-accent-300 border border-accent-300"
        timestamps={timestamps}
        series={series}
        colors={[plotColor]}
        height={300}
        hideLegend
      />
      <p className="font-medium text-center text-lg text-accent-900">
        Сенсор {id + 1}
      </p>
    </div>
  );
};
export default Plot;
