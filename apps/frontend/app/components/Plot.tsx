import { LineChart } from "@mui/x-charts";

interface Props {
  id: number;
  timestamps: number[];
  sensorData: number[];
}

const Plot = ({ id, timestamps, sensorData }: Props) => {
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
export default Plot;
