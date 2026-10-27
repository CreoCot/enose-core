import { useContext, useEffect, useRef, useState } from "react";
import { SENSOR_PALETTE, SensorColorsContext, sensorColor } from "../lib/utils";

interface Props {
  renderedPlotIds: Record<string, boolean>;
  handleCheckboxClick: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

const SensorList = ({ renderedPlotIds, handleCheckboxClick }: Props) => {
  const { overrides, setColor, clearColor, resetColors } =
    useContext(SensorColorsContext);
  const customised = Object.keys(overrides).length > 0;
  // Индекс сенсора, у которого открыта палитра
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (openIndex === null) return;
    const close = (e: MouseEvent) => {
      if (!listRef.current?.contains(e.target as Node)) setOpenIndex(null);
    };
    const onKey = (e: KeyboardEvent) =>
      e.key === "Escape" && setOpenIndex(null);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", onKey);
    };
  }, [openIndex]);

  return (
    <div ref={listRef} className="flex flex-col justify-between px-5 lg:px-6 ">
      {Object.entries(renderedPlotIds).map(([k, v], i) => (
        <div
          key={`SensorList_div_${i}`}
          className="relative text-grey-800 font-semibold text-lg lg:gap-2 flex items-baseline py-4 h-full"
        >
          <input
            type="checkbox"
            onChange={handleCheckboxClick}
            key={`checkbox_${i + 1}`}
            id={`${i}`}
            checked={renderedPlotIds[i]}
          />
          <span className="hidden sm:flex text-nowrap">S{i + 1}</span>
          {/* Размеры в px: rem на этом сайте крупный, а образец должен быть мелким */}
          <button
            type="button"
            aria-label={`Цвет S${i + 1}`}
            title={`Цвет S${i + 1}`}
            onClick={() => setOpenIndex(openIndex === i ? null : i)}
            style={
              { "--swatch": sensorColor(overrides, i) } as React.CSSProperties
            }
            className="color-swatch no-export h-[22px] w-[22px] shrink-0 cursor-pointer self-baseline rounded border border-primary-300 p-0"
          />
          {openIndex === i && (
            <div className="no-export absolute left-full top-1/2 z-20 ml-2 flex w-[150px] -translate-y-1/2 flex-col gap-2 rounded-[10px] border border-primary-300 bg-white p-2 shadow-md">
              <div className="grid grid-cols-5 gap-1">
                {SENSOR_PALETTE.map((color) => (
                  <button
                    key={color}
                    type="button"
                    aria-label={color}
                    onClick={() => {
                      setColor(i, color);
                      setOpenIndex(null);
                    }}
                    style={{ "--swatch": color } as React.CSSProperties}
                    className={`color-swatch h-[24px] w-[24px] cursor-pointer rounded p-0 ${
                      sensorColor(overrides, i) === color
                        ? "border-2 border-grey-800"
                        : "border border-primary-300"
                    }`}
                  />
                ))}
              </div>
              <button
                type="button"
                onClick={() => {
                  clearColor(i);
                  setOpenIndex(null);
                }}
                className="cursor-pointer whitespace-nowrap text-sm font-normal text-grey-600 underline hover:text-grey-800"
              >
                по умолчанию
              </button>
            </div>
          )}
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
