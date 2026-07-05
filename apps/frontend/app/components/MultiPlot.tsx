import { LineChart } from "@mui/x-charts";
import { hsla } from "motion/react";
import React, { useMemo, useState } from "react";

interface Props {
  timestamps: number[];
  sensorData: number[][];
  sensorSize: number;
  error: string;
}

const MultiPlot = ({ timestamps, sensorData, sensorSize, error }: Props) => {
  const [renderedPlotIds, setRenderedPlotIds] = useState<
    Record<string, boolean>
  >(() =>
    Object.fromEntries(
      Array.from({ length: sensorSize }, (_, i) => [i.toString(), false]),
    ),
  );
  const handleCheckboxClick = (e: React.ChangeEvent<HTMLInputElement>) => {
    setRenderedPlotIds((prev) => ({
      ...prev,
      [e.target.id]: e.target.checked,
    }));
  };
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
        <div className="flex bg-grey-100 md:mx-8 my-4 rounded-[10px] shadow-md shadow-accent-200 border border-accent-300">
          <div className="flex flex-col justify-between p-5 lg:p-6 gap-6">
            {Array.from({ length: sensorSize }, (_, i) => (
              <div className="text-grey-800 font-semibold text-lg lg:gap-2 flex">
                <input
                  type="checkbox"
                  onChange={handleCheckboxClick}
                  key={`checkbox_${i + 1}`}
                  id={`${i}`}
                />
                <span className="hidden sm:flex">Сенсор {i + 1}</span>
              </div>
            ))}
          </div>
          {plots}
        </div>
      )}
    </div>
  );
};

export default MultiPlot;
