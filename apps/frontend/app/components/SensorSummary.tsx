import SensorList from "./SensorList";

interface Props {
  data:
    | {
        baseFrequency: number;
        minDelta: [number, number];
        maxDelta: [number, number];
        absMax: [number, number];
      }[]
    | undefined;
  error: string;
  renderedPlotIds: Record<string, boolean>;
  handleCheckboxClick: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

interface DataProps {
  baseFrequency: number;
  minDelta: [number, number];
  maxDelta: [number, number];
  absMax: [number, number];
  index: number;
}

const SensorData = ({
  baseFrequency,
  minDelta,
  maxDelta,
  absMax,
  index,
}: DataProps) => {
  return (
    <div className="flex flex-col bg-white mx-4 gap-3 rounded-[15px] py-4">
      <div className="text-grey-700 font-bold text-xl py-1 px-6">
        Сенсор {index + 1}
      </div>
      <div className="flex px-6 gap-4 justify-baseline">
        <p className="text-grey-700 text-base font-medium">Базовая частота</p>
        <p className="text-gray-900 text-lg font-bold text-nowrap justify-end flex w-full">
          {baseFrequency} Гц
        </p>
      </div>
      <div className="flex px-6 gap-4 justify-baseline">
        <p className="text-grey-700 text-base font-medium">Минимальная Δ</p>
        <div className="flex w-full justify-end gap-4">
          <p className="text-gray-900 text-lg font-bold text-nowrap">
            {minDelta[0]} с
          </p>
          <p className="text-gray-900 text-lg font-bold text-nowrap">
            {minDelta[1]} Гц
          </p>
        </div>
      </div>
      <div className="flex px-6 gap-4 justify-baseline">
        <p className="text-grey-700 text-base font-medium">Максимальная Δ</p>
        <div className="flex w-full justify-end gap-4">
          <p className="text-gray-900 text-lg font-bold text-nowrap">
            {maxDelta[0]} с
          </p>
          <p className="text-gray-900 text-lg font-bold text-nowrap">
            {maxDelta[1]} Гц
          </p>
        </div>
      </div>
      <div className="flex px-6 gap-4 justify-baseline">
        <p className="text-grey-700 text-base font-medium">
          Максимальная абсолютная Δ
        </p>
        <div className="flex w-full justify-end gap-4">
          <p className="text-gray-900 text-lg font-bold text-nowrap">
            {absMax[0]} с
          </p>
          <p className="text-gray-900 text-lg font-bold text-nowrap">
            {absMax[1]} Гц
          </p>
        </div>
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
        <div className="text-primary-700 font-bold text-2xl lg:text-3xl md:mx-8 my-4">
          {error}
        </div>
      )}
      {error.length === 0 && (
        <div className="flex bg-grey-100 md:mx-8 my-4 rounded-[10px] shadow-md lg:py-5 px-4 md:px-5 2xl:px-6 shadow-primary-200 border border-primary-300">
          <SensorList
            renderedPlotIds={renderedPlotIds}
            handleCheckboxClick={handleCheckboxClick}
          />
          <div className="w-full h-fit grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-x-7 px-2 gap-y-6 py-4">
            {data?.map((item, i) => {
              if (renderedPlotIds[i])
                return (
                  <SensorData
                    baseFrequency={item.baseFrequency}
                    minDelta={item.minDelta}
                    maxDelta={item.maxDelta}
                    absMax={item.absMax}
                    index={i}
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
