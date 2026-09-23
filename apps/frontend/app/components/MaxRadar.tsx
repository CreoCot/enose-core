import { RadarAxis, RadarChart } from "@mui/x-charts/RadarChart";
import { useEffect, useMemo, useState } from "react";
import SensorList from "./SensorList";
import { radarArea } from "../lib/masks";

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
  const initialPlotMax = Math.max(globalMax, 1);
  const [plotMin, setPlotMin] = useState(0);
  const [plotMax, setPlotMax] = useState(initialPlotMax);
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

  // Площадь диаграммы по формуле MAG-soft; значения отсчитываются от минимума оси
  const area = radarArea(renderedArray.map((v) => Math.max(0, v - plotMin)));

  const metrics = useMemo(
    () =>
      Object.entries(truePlotIds).map(([k, _]) => ({
        name: `Сенсор ${Number(k) + 1}`,
        min: plotMin,
        max: plotMax,
      })),
    [plotMax, plotMin, truePlotIds],
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
              metric={metrics[0]?.name}
              divisions={Math.max(1, Math.ceil((plotMax - plotMin) / 2))}
              labelOrientation="horizontal"
              angle={0}
            />
          </RadarChart>
          <div className="flex flex-col justify-start p-5 h-full">
            <div className="flex flex-col p-6 gap-5 border-2 border-primary-200 rounded-[10px] shadow-sm shadow-primary-200">
              <p className="text-primary-800 font-semibold text-2xl">Масштаб</p>
              <div className="flex flex-col gap-3">
                <label className="flex flex-col gap-2 text-primary-700 text-xl">
                  Минимум
                  <input
                    type="number"
                    min={0}
                    max={plotMax}
                    step="any"
                    value={plotMin}
                    onChange={(event) => {
                      const value = Number(event.target.value);
                      if (
                        Number.isFinite(value) &&
                        value >= 0 &&
                        value < plotMax
                      ) {
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
                    className="w-10 border border-primary-300 rounded-[10px] px-3 py-1 text-primary-600 text-lg"
                  />
                </label>
              </div>
            </div>
            <div className="mt-5 flex flex-col gap-1 rounded-[10px] border-2 border-primary-200 p-6 shadow-sm shadow-primary-200">
              <p className="text-primary-800 font-semibold text-2xl">Площадь</p>
              <p className="text-primary-700 text-xl">{area.toFixed(2)}</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default MaxRadar;
