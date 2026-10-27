import React, { useContext, useMemo } from "react";
import SensorList from "./SensorList";
import ZoomableChart from "./ZoomableChart";
import { SensorColorsContext, sensorColor } from "../lib/utils";

interface Props {
  timestamps: number[];
  sensorData: number[][];
  sensorSize: number;
  error: string;
  renderedPlotIds: Record<string, boolean>;
  handleCheckboxClick: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

const MultiPlot = ({
  timestamps,
  sensorData,
  error,
  renderedPlotIds,
  handleCheckboxClick,
}: Props) => {
  const { overrides } = useContext(SensorColorsContext);
  const plots = useMemo(() => {
    const activeSeries = sensorData
      .map((arr, i) => {
        if (renderedPlotIds[i.toString()] !== true) return null;
        return {
          id: `sensor-${i}`,
          data: arr,
          label: `S${i + 1}`,
          color: sensorColor(overrides, i),
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    return (
      <ZoomableChart
        className="w-full download-image"
        colors={activeSeries.map((item) => item.color)}
        timestamps={timestamps}
        series={activeSeries}
        height={560}
        controls
      />
    );
  }, [renderedPlotIds, sensorData, timestamps, overrides]);
  return (
    <div className="flex flex-col gap-3 w-full h-full">
      {error.length !== 0 && (
        <div className="text-primary-700 font-bold text-2xl lg:text-3xl mx-8 my-4">
          {error}
        </div>
      )}
      {error.length === 0 && (
        <div className="flex bg-grey-100 md:mx-8 my-4 lg:py-5 px-4 md:px-5 2xl:px-6 rounded-[10px] shadow-md shadow-accent-200 border border-accent-300">
          <SensorList
            renderedPlotIds={renderedPlotIds}
            handleCheckboxClick={handleCheckboxClick}
          />
          {plots}
        </div>
      )}
    </div>
  );
};

export default MultiPlot;
