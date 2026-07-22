import { LineChart } from "@mui/x-charts";
import { hsla } from "motion/react";
import React, { useMemo, useState } from "react";
import SensorList from "./SensorList";

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
  const generateColors = (count: number): string[] => {
    const colors: string[] = [];
    for (let i = 0; i < count; i++) {
      const hue = (i * 41) % 360;
      colors.push(`hsl(${hue + 266}, 60%, 52%)`); // starting from accent-500; pretty :D
    }
    return colors;
  };
  const plots = useMemo(() => {
    const activeSeries = sensorData
      .map((arr, i) => {
        if (renderedPlotIds[i.toString()] !== true) return null;
        return {
          id: `sensor-${i}`,
          data: arr,
          label: `Сенсор ${i + 1}`,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    return (
      <LineChart
        className="-ml-5 -mb-3 -mr-1"
        colors={generateColors(
          Object.values(renderedPlotIds).filter((value) => value === true)
            .length,
        )}
        xAxis={[
          {
            data: timestamps,
          },
        ]}
        series={activeSeries}
        height={384}
      />
    );
  }, [renderedPlotIds]);
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
          <div className=""></div>
          {plots}
        </div>
      )}
    </div>
  );
};

export default MultiPlot;
