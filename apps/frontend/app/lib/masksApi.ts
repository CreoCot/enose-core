import { isAxiosError } from "axios";
import api from "../axios";
import type { Mask } from "./masks";

export async function fetchMasks(): Promise<Mask[]> {
  const { data } = await api.get<Mask[]>("/api/v1/masks");
  return data;
}

export async function createMask(
  name: string,
  points: number[],
): Promise<Mask> {
  const { data } = await api.post<Mask>("/api/v1/masks", { name, points });
  return data;
}

export async function updateMask(
  id: number,
  name: string,
  points: number[],
): Promise<Mask> {
  const { data } = await api.put<Mask>(`/api/v1/masks/${id}`, { name, points });
  return data;
}

export async function deleteMask(id: number): Promise<void> {
  await api.delete(`/api/v1/masks/${id}`);
}

export async function fetchDefaultMaskId(
  entryId: number,
): Promise<number | null> {
  const { data } = await api.get<{ default_mask_id: number | null }>(
    `/api/v1/entries/${entryId}`,
  );
  return data.default_mask_id;
}

export async function setEntryMask(
  entryId: number,
  maskId: number | null,
): Promise<void> {
  await api.put(`/api/v1/entries/${entryId}/mask`, { mask_id: maskId });
}

/** Понятное сообщение об ошибке запроса к API масок. */
export function maskErrorMessage(error: unknown): string {
  if (isAxiosError(error) && error.response) {
    const data = error.response.data as { error?: string; message?: string };
    if (data?.error === "mask_name_taken") {
      return "Маска с таким именем уже существует";
    }
    if (error.response.status === 403) {
      return "Менять эту маску может только её создатель или администратор";
    }
    if (data?.message) return data.message;
  }
  return error instanceof Error ? error.message : "Что-то пошло не так";
}
