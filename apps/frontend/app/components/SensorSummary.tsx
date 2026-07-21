import SensorList from "./SensorList";

interface Props {
  data: DataProps[] | undefined;
  error: string;
  renderedPlotIds: Record<string, boolean>;
  handleCheckboxClick: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

interface DataProps {
  baseFrequency: number;
  minDelta: [number, number];
  maxDelta: [number, number];
  absMax: [number, number];
}

const SensorData = ({
  baseFrequency,
  minDelta,
  maxDelta,
  absMax,
}: DataProps) => {
  return (
    <div className="flex gap-5">
      <div className="flex flex-col p-4 bg-white rounded-[15px]">
        <p className="text-grey-700 text-base font-medium">Базовая частота</p>
        <p className="text-gray-900 text-lg font-bold">{baseFrequency}</p>
      </div>
      <div className="flex flex-col p-4 bg-white rounded-[15px]">
        <p className="text-grey-700 text-base font-medium">Минимальная Δ</p>
        <p className="text-gray-900 text-lg font-bold">
          {minDelta[0]} {minDelta[1]}
        </p>
      </div>
      <div className="flex flex-col p-4 bg-white rounded-[15px]">
        <p className="text-grey-700 text-base font-medium">Максимальная Δ</p>
        <p className="text-gray-900 text-lg font-bold">
          {maxDelta[0]} {maxDelta[1]}
        </p>
      </div>
      <div className="flex flex-col p-4 bg-white rounded-[15px]">
        <p className="text-grey-700 text-base font-medium">
          Максимальная абсолютная Δ
        </p>
        <p className="text-gray-900 text-lg font-bold">
          {absMax[0]} {absMax[1]}
        </p>
      </div>
    </div>
  );
};

const SensorSummary = ({
  data,
  error,
  renderedPlotIds,
  handleCheckboxClick,
}: Props) => {
  return (
    <>
      {error.length !== 0 && (
        <div className="text-primary-700 font-bold text-2xl lg:text-3xl mx-8 my-4">
          {error}
        </div>
      )}
      {error.length === 0 && (
        <div className="flex bg-grey-50">
          <SensorList
            renderedPlotIds={renderedPlotIds}
            handleCheckboxClick={handleCheckboxClick}
          />
          <div className="flex flex-col">
            {data?.map((item, i) => {
              if (renderedPlotIds[i])
                return (
                  <SensorData
                    baseFrequency={item.baseFrequency}
                    minDelta={item.minDelta}
                    maxDelta={item.maxDelta}
                    absMax={item.absMax}
                  />
                );
            })}
          </div>
        </div>
      )}
    </>
  );
};

export default SensorSummary;
