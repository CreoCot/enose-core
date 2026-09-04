import { RadarAxis, RadarChart } from "@mui/x-charts/RadarChart";
import { useEffect, useMemo, useState } from "react";
import SensorList from "./SensorList";

interface Props {
  maxArray: number[];
  sensorSize: number;
  error: string;
  renderedPlotIds: Record<string, boolean>;
  handleCheckboxClick: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleLessThanTwo: () => void;
}

const MaxRadar = ({
  maxArray,
  sensorSize,
  error,
  renderedPlotIds,
  handleCheckboxClick,
  handleLessThanTwo,
}: Props) => {
  const globalMax = Math.max(
    0,
    ...maxArray.filter((val) => typeof val === "number"),
  );
  const [plotMax, setPlotMax] = useState(globalMax);
  const plotColor = "#4b4bc3";
  useEffect(() => {
    const activeCount = Object.values(renderedPlotIds).filter(Boolean).length;
    if (activeCount <= 2) {
      handleLessThanTwo();
    }
  }, [renderedPlotIds, handleLessThanTwo]);

  const truePlotIds = Object.fromEntries(
    Object.entries(renderedPlotIds).filter(([_, v]) => v === true),
  );

  const renderedArray = Object.entries(truePlotIds).map(([k, _]) => {
    const value = maxArray[Number(k)];
    return typeof value === "number" ? value : 0;
  });

  const metrics = useMemo(
    () =>
      Object.entries(truePlotIds).map(([k, _]) => `Сенсор ${Number(k) + 1}`),
    [truePlotIds],
  );
  const firstMetric = metrics[0];
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
          <RadarChart
            key={metrics.length}
            colors={[plotColor]}
            className="mx-8 my-4 rounded-[10px] shadow-sm shadow-primary-200 border-2 border-primary-200"
            height={640}
            series={[{ data: renderedArray, fillArea: true }]}
            radar={{
              max: plotMax,
              metrics: metrics,
            }}
          >
            <RadarAxis
              metric={firstMetric}
              divisions={plotMax / 2}
              labelOrientation="horizontal"
              angle={0}
            />
          </RadarChart>
          <div className="flex flex-col justify-start p-5 h-full">
            <div className="flex flex-col p-6 gap-5 border-2 border-primary-200 rounded-[10px] shadow-sm shadow-primary-200">
              <p className="text-primary-800 font-semibold">Масштаб</p>
              <div className="flex justify-between">
                <button
                  disabled={plotMax <= 4}
                  onClick={() => setPlotMax((prev) => prev - prev / 10)}
                  className="p-4 border border-primary-300 rounded-[10px] text-primary-600 cursor-pointer disabled:cursor-not-allowed disabled:border-primary-200"
                >
                  -
                </button>
                <button
                  onClick={() => setPlotMax((prev) => prev + prev / 10)}
                  className="p-4 border border-primary-300 rounded-[10px] text-primary-600 cursor-pointer"
                >
                  +
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default MaxRadar;
