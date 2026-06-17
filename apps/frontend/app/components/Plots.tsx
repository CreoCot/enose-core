import { LineChart } from "@mui/x-charts";

interface PlotProps {
  id: number;
  timestamps: number[];
  sensorData: number[];
}

interface Props {
  sensorSize: number;
  timestamps: number[];
  data: number[][];
  error: string;
}

const Plot = ({ id, timestamps, sensorData }: PlotProps) => {
  const plotColor = "#7B3BCE"; // accent-500
  return (
    <div className="flex flex-col gap-3 w-full h-full">
      <div className="rounded-[10px] shadow-sm shadow-accent-300 border border-accent-300">
        <LineChart
          className="-ml-3 -mb-3 -mr-1"
          colors={[plotColor]}
          xAxis={[
            {
              data: timestamps,
            },
          ]}
          series={[
            {
              data: sensorData,
            },
          ]}
          height={300}
        />
      </div>
      <p className="font-medium text-center text-lg text-accent-900">
        Сенсор {id + 1}
      </p>
    </div>
  );
};

const Plots = ({ sensorSize, timestamps, data, error }: Props) => {
  return (
    <>
      {sensorSize === 0 && (
        <div className="text-primary-700 font-bold text-3xl mx-8 my-4">
          {error.length === 0 ? "Получаем данные..." : error}
        </div>
      )}
      {sensorSize !== 0 && (
        <div className="grid grid-cols-3 gap-x-10 px-8 gap-y-7 py-6 bg-accent-100 mx-8 my-4 rounded-[10px] shadow-md shadow-accent-200 border border-primary-300">
          {Array.from({ length: sensorSize }, (_, i) => (
            <Plot id={i} timestamps={timestamps} sensorData={data[i]} />
          ))}
        </div>
      )}
    </>
  );
};

export default Plots;
