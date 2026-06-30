import Plot from "./Plot";

interface Props {
  sensorSize: number;
  timestamps: number[];
  data: number[][];
  error: string;
}

const Plots = ({ sensorSize, timestamps, data, error }: Props) => {
  return (
    <>
      {error.length !== 0 && (
        <div className="text-primary-700 font-bold text-2xl lg:text-3xl mx-8 my-4">
          {error}
        </div>
      )}
      {error.length === 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-x-8 px-6 md:px-7 2xl:px-8 gap-y-6 py-6 bg-grey-100 mx-8 my-4 rounded-[10px] shadow-md shadow-accent-200 border border-accent-300">
          {Array.from({ length: sensorSize }, (_, i) => (
            <Plot
              key={`plot${i}`}
              id={i}
              timestamps={timestamps}
              sensorData={data[i]}
            />
          ))}
        </div>
      )}
    </>
  );
};

export default Plots;
