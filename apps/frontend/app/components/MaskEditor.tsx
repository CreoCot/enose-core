import { useEffect, useMemo, useState } from "react";
import {
  formatMaskPoints,
  normalizePoints,
  parseMaskInput,
  type Mask,
} from "../lib/masks";
import {
  createMask,
  deleteMask,
  maskErrorMessage,
  updateMask,
} from "../lib/masksApi";

interface Props {
  masks: Mask[];
  /** Маска, выбранная в пикере при открытии редактора */
  initialId: number | null;
  onClose: () => void;
  /** Список изменился (создание/правка/удаление); selectId — что выбрать */
  onChanged: (masks: Mask[], selectId: number | null) => void;
  reload: () => Promise<Mask[]>;
}

const MaskEditor = ({
  masks,
  initialId,
  onClose,
  onChanged,
  reload,
}: Props) => {
  const [editingId, setEditingId] = useState<number | null>(initialId);
  const editing = masks.find((m) => m.id === editingId) ?? null;
  const [name, setName] = useState(editing?.name ?? "");
  const [text, setText] = useState(
    editing ? formatMaskPoints(editing.points) : "",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const choose = (mask: Mask | null) => {
    setEditingId(mask?.id ?? null);
    setName(mask?.name ?? "");
    setText(mask ? formatMaskPoints(mask.points) : "");
    setError("");
  };

  const parsed = useMemo(() => parseMaskInput(text), [text]);
  const points = useMemo(() => normalizePoints(parsed.points), [parsed]);

  const validate = (): boolean => {
    if (!name.trim()) return setError("Введите название маски"), false;
    if (parsed.error) return setError(parsed.error), false;
    if (points.length < 2)
      return setError("Нужно минимум две различные точки"), false;
    return true;
  };

  const run = async (action: () => Promise<Mask | null>) => {
    if (!validate()) return;
    setBusy(true);
    setError("");
    try {
      const saved = await action();
      const list = await reload();
      onChanged(list, saved?.id ?? null);
      if (saved) setEditingId(saved.id);
      else choose(null);
    } catch (e) {
      setError(maskErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const save = () =>
    run(() =>
      editing && editing.editable
        ? updateMask(editing.id, name.trim(), points)
        : createMask(name.trim(), points),
    );
  const saveAsNew = () => run(() => createMask(name.trim(), points));
  const remove = async () => {
    if (!editing || !window.confirm(`Удалить маску «${editing.name}»?`)) return;
    setBusy(true);
    setError("");
    try {
      await deleteMask(editing.id);
      const list = await reload();
      onChanged(list, null);
      choose(null);
    } catch (e) {
      setError(maskErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const canOverwrite = !editing || editing.editable;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Редактор масок"
        className="flex max-h-[90vh] w-full max-w-3xl flex-col gap-4 overflow-auto rounded-[15px] border border-accent-300 bg-grey-50 p-6 shadow-xl"
      >
        <div className="flex items-start justify-between">
          <h2 className="text-2xl font-semibold text-primary-800">Маски</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="text-2xl leading-none text-grey-600 hover:text-grey-800"
          >
            ×
          </button>
        </div>
        <p className="text-grey-700">
          Маска — список моментов времени (секунды), в которых оцениваются
          кривые: экстремумы, диаграмма максимумов и сводка считаются только по
          её точкам.
        </p>

        <div className="flex flex-col gap-5 sm:flex-row">
          <div className="flex min-w-48 flex-col gap-1.5 sm:w-56">
            <button
              type="button"
              onClick={() => choose(null)}
              className={`rounded-[10px] border px-3 py-1.5 text-left transition-all duration-300 ${
                editingId === null
                  ? "border-accent-500 bg-accent-100 font-semibold text-accent-700"
                  : "border-accent-300 hover:bg-accent-100 text-accent-700 hover:text-accent-600"
              }`}
            >
              + Новая маска
            </button>
            <div className="flex max-h-64 flex-col gap-1.5 overflow-auto">
              {masks.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => choose(m)}
                  className={`rounded-[10px] border px-3 py-1.5 text-left transition-all duration-300 text-grey-500 ${
                    editingId === m.id
                      ? "border-primary-500 bg-primary-100 text-primary-500 hover:text-primary-600"
                      : "border-grey-100 bg-grey-100 hover:bg-primary-100 hover:text-primary-500"
                  }`}
                >
                  <p
                    className={`${
                      editingId === m.id
                        ? "text-primary-600 font-semibold transition-all duration-300"
                        : ""
                    }`}
                  >
                    {m.name}
                  </p>
                  <span className={`block text-sm`}>
                    {m.points.length} точек
                  </span>
                </button>
              ))}
              {masks.length === 0 && (
                <span className="px-1 text-grey-600">Масок пока нет</span>
              )}
            </div>
          </div>

          <div className="flex flex-1 flex-col gap-3">
            <label className="flex flex-col gap-1 text-grey-800">
              Название
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={128}
                className="rounded-[10px] border border-primary-300 bg-white px-3 py-1.5"
              />
            </label>
            <label className="flex flex-col gap-1 text-grey-800">
              Моменты времени, с (через пробел или с новой строки)
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={6}
                placeholder="0 10 20 30 60"
                className="rounded-[10px] border border-primary-300 bg-white px-3 py-1.5 font-mono"
              />
            </label>
            <p className="text-sm text-grey-600">
              {parsed.error
                ? ""
                : `Точек: ${points.length}` +
                  (points.length
                    ? ` · от ${points[0]} до ${points[points.length - 1]} с`
                    : "")}
            </p>
            {error && (
              <p
                role="alert"
                className="rounded-[10px] bg-red-100 px-3 py-2 text-red-800"
              >
                {error}
              </p>
            )}
            {editing && !editing.editable && (
              <p className="text-sm text-grey-600">
                Эту маску создал другой пользователь — её можно только
                использовать или сохранить копию.
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy || !canOverwrite}
                onClick={save}
                className="rounded-full bg-primary-200 px-4 py-1.5 text-primary-500 font-semibold border-2 border-primary-400 hover:bg-primary-300 cursor-pointer transition-colors duration-300 disabled:opacity-40"
              >
                Сохранить
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={saveAsNew}
                className="rounded-full bg-accent-200 px-4 py-1.5 text-accent-600 font-semibold border border-accent-500 hover:bg-accent-300 cursor-pointer transition-colors duration-300 disabled:opacity-40"
              >
                Сохранить как новую
              </button>
              <button
                type="button"
                disabled={busy || !editing || !editing.editable}
                onClick={remove}
                className="rounded-full bg-red-200 px-4 py-1.5 text-red-700 hover:bg-red-100 transition-colors duration-300 cursor-pointer font-light border border-red-400 disabled:opacity-40"
              >
                Удалить
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MaskEditor;
