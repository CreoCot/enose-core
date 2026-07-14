import { RadarChart } from "@mui/x-charts/RadarChart";

interface Props {
  maxArray: number[];
  sensorSize: number;
  error: string;
}

const MaxRadar = ({ maxArray, sensorSize, error }: Props) => {
  const globalMax = Math.max(...maxArray, 0);
  const plotColor = "#4b4bc3";
  return (
    <>
      {error.length !== 0 && (
        <div className="text-primary-700 font-bold text-2xl lg:text-3xl mx-8 my-4">
          {error}
        </div>
      )}

      {error.length === 0 && (
        <RadarChart
          colors={[plotColor]}
          className="lg:py-6 px-6 md:px-7 2xl:px-8 bg-grey-100 md:mx-8 my-4 rounded-[10px] shadow-md shadow-primary-200 border border-primary-300"
          height={768}
          series={[{ data: maxArray, fillArea: true }]}
          radar={{
            max: globalMax,
            metrics: [
              ...Array.from({ length: sensorSize }, (_, i) => {
                return `Сенсор ${i + 1}`;
              }),
            ],
          }}
        />
      )}
    </>
  );
};

export default MaxRadar;
