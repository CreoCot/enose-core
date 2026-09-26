import { useState } from "react";
import type { Mask } from "../lib/masks";
import { fetchMasks, maskErrorMessage, setEntryMask } from "../lib/masksApi";
import MaskEditor from "./MaskEditor";

interface Props {
  entryId: number;
  masks: Mask[];
  selectedId: number | null;
  /** Маска записи по умолчанию (сохранена на сервере) */
  defaultId: number | null;
  onSelect: (id: number | null) => void;
  onMasksChange: (masks: Mask[]) => void;
  onDefaultChange: (id: number | null) => void;
}

const MaskPicker = ({
  entryId,
  masks,
  selectedId,
  defaultId,
  onSelect,
  onMasksChange,
  onDefaultChange,
}: Props) => {
  const [editorOpen, setEditorOpen] = useState(false);
  const [error, setError] = useState("");
  const selected = masks.find((m) => m.id === selectedId) ?? null;

  const saveDefault = async () => {
    setError("");
    try {
      await setEntryMask(entryId, selectedId);
      onDefaultChange(selectedId);
    } catch (e) {
      setError(maskErrorMessage(e));
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-6 pt-3 text-lg text-grey-800 sm:px-13">
      <label className="flex items-center gap-2">
        Маска
        <select
          value={selectedId ?? ""}
          onChange={(e) =>
            onSelect(e.target.value === "" ? null : Number(e.target.value))
          }
          className="rounded-[10px] border border-primary-300 bg-white px-3 py-1"
        >
          <option value="">Без маски</option>
          {masks.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        onClick={() => setEditorOpen(true)}
        className="rounded-full bg-accent-100 px-4 py-1 text-accent-700 transition-colors duration-300 hover:bg-accent-200 border border-primary-300"
      >
        Маски…
      </button>
      {selectedId !== defaultId && (
        <button
          type="button"
          onClick={saveDefault}
          className="rounded-full bg-primary-100 px-4 py-1 text-primary-600 transition-colors duration-300 hover:bg-primary-200 border border-primary-300"
        >
          {selectedId === null ? "Снять маску записи" : "Сделать маской записи"}
        </button>
      )}
      {selected && (
        <span className="text-base text-grey-600">
          {selected.points.length} точек, {selected.points[0]}–
          {selected.points[selected.points.length - 1]} с
        </span>
      )}
      {error && <span className="text-base text-red-700">{error}</span>}

      {editorOpen && (
        <MaskEditor
          masks={masks}
          initialId={selectedId}
          reload={fetchMasks}
          onClose={() => setEditorOpen(false)}
          onChanged={(list, selectId) => {
            onMasksChange(list);
            // удалённая маска больше не может быть выбранной
            if (selectedId !== null && !list.some((m) => m.id === selectedId)) {
              onSelect(null);
            }
            if (selectId !== null) onSelect(selectId);
          }}
        />
      )}
    </div>
  );
};

export default MaskPicker;
