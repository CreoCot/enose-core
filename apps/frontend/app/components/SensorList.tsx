import { useContext } from "react";
import { SensorColorsContext, sensorColor } from "../lib/utils";

interface Props {
  renderedPlotIds: Record<string, boolean>;
  handleCheckboxClick: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

const SensorList = ({ renderedPlotIds, handleCheckboxClick }: Props) => {
  const { overrides, setColor, resetColors } = useContext(SensorColorsContext);
  const customised = Object.keys(overrides).length > 0;
  return (
    <div className="flex flex-col justify-between px-5 lg:px-6 ">
      {Object.entries(renderedPlotIds).map(([k, v], i) => (
        <div
          key={`SensorList_div_${i}`}
          className="text-grey-800 font-semibold text-lg lg:gap-2 flex items-baseline py-4 h-full"
        >
          <input
            type="checkbox"
            onChange={handleCheckboxClick}
            key={`checkbox_${i + 1}`}
            id={`${i}`}
            checked={renderedPlotIds[i]}
          />
          <span className="hidden sm:flex text-nowrap">S{i + 1}</span>
          {/* Размер в px: rem на этом сайте крупный, а swatch должен быть мелким */}
          <input
            type="color"
            aria-label={`Цвет S${i + 1}`}
            title={`Цвет S${i + 1}`}
            value={sensorColor(overrides, i)}
            onChange={(e) => setColor(i, e.target.value)}
            className="no-export h-[22px] w-[22px] shrink-0 cursor-pointer self-baseline rounded border border-primary-300 bg-transparent p-0"
          />
        </div>
      ))}
      {customised && (
        <button
          type="button"
          onClick={resetColors}
          className="no-export mt-1 w-fit cursor-pointer whitespace-nowrap text-sm text-grey-600 underline hover:text-grey-800"
        >
          сбросить цвета
        </button>
      )}
    </div>
  );
};

export default SensorList;
