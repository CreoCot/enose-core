interface Props {
  renderedPlotIds: Record<string, boolean>;
  handleCheckboxClick: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

const SensorList = ({ renderedPlotIds, handleCheckboxClick }: Props) => {
  return (
    <div className="flex flex-col justify-between p-5 lg:p-6 gap-6">
      {Object.entries(renderedPlotIds).map(([k, v], i) => (
        <div
          key={`SensorList_div_${i}`}
          className="text-grey-800 font-semibold text-lg lg:gap-2 flex"
        >
          <input
            type="checkbox"
            onChange={handleCheckboxClick}
            key={`checkbox_${i + 1}`}
            id={`${i}`}
            checked={renderedPlotIds[i]}
          />
          <span className="hidden sm:flex">Сенсор {i + 1}</span>
        </div>
      ))}
    </div>
  );
};

export default SensorList;
