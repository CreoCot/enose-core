import { RadarChart } from "@mui/x-charts/RadarChart";
import { useEffect, useMemo } from "react";
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
            colors={[plotColor]}
            className="mx-8 my-4 rounded-[10px] shadow-sm shadow-primary-200 border border-primary-200"
            height={768}
            series={[{ data: renderedArray, fillArea: true }]}
            radar={{
              max: globalMax,
              metrics: metrics,
            }}
          />
        </div>
      )}
    </>
  );
};

export default MaxRadar;
