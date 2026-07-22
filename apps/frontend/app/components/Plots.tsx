import Plot from "./Plot";
import SensorList from "./SensorList";

interface Props {
  sensorSize: number;
  timestamps: number[];
  data: number[][];
  error: string;
  renderedPlotIds: Record<string, boolean>;
  handleCheckboxClick: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

const Plots = ({
  sensorSize,
  timestamps,
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
        <div className="flex gap-5 bg-grey-100 md:mx-8 my-4 rounded-[10px] shadow-md shadow-accent-200 border border-accent-300 lg:py-5 px-4 md:px-5 2xl:px-6">
          <SensorList
            renderedPlotIds={renderedPlotIds}
            handleCheckboxClick={handleCheckboxClick}
          />
          <div className="w-full grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-x-8 px-2 gap-y-6 py-4">
            {Array.from({ length: sensorSize }, (_, i) => {
              if (renderedPlotIds[i])
                return (
                  <Plot
                    key={`plot${i}`}
                    id={i}
                    timestamps={timestamps}
                    sensorData={data[i]}
                  />
                );
            })}
          </div>
        </div>
      )}
    </>
  );
};

export default Plots;
