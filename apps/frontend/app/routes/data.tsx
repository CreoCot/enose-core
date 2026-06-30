import Head from "../components/Head";
import FileTable from "../components/FileTable";
import type { Route } from "./+types/data";
import axios from "../axios";
import { isAxiosError } from "axios";
import { useFetcher, type ClientActionFunctionArgs } from "react-router";

export type Entry = {
  id: number;
  name: string;
  date: string;
};

let entryCache: Entry[] | null = null;

export function setEntryCacheNull() {
  entryCache = null;
  clientLoader();
}

export async function clientLoader() {
  const cache = entryCache;
  if (cache !== null) {
    return { entries: cache, entryError: "" };
  }
  let entries: Entry[] = [],
    entryError: string = "";
  try {
    const response = await axios.get("/api/v1/entries");
    console.log(response);
    if (!response.data.entries) entryError = "Ошибка API";
    entries = response.data.entries;
  } catch (error) {
    if (isAxiosError(error) && error.response) {
      if (error.response.data.error) {
        entryError = error.response.data.error;
      } else {
        entryError = error.response.data;
      }
    } else if (error instanceof Error) {
      entryError = error.message;
    } else {
      entryError = "Что-то пошло не так";
    }
  }
  return { entries, entryError };
}

export const clientAction = async ({ request }: ClientActionFunctionArgs) => {
  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  if (!file || file.size === 0) {
    return { error: "No file provided" };
  }

  const uploadData = new FormData();
  uploadData.append("file", file);
  console.log(formData);
  try {
    const response = await axios.post("/api/v1/upload", uploadData);
    return { success: true, url: response.data.url };
  } catch (error) {
    return { error: "Upload failed" };
  }
};

export function HydrateFallback() {
  <div className="flex justify-center">
    <FileTable entries={[]} error={""} />
  </div>;
}

const data = ({ loaderData }: Route.ComponentProps) => {
  const { entries = [], entryError = "" } = loaderData || {};
  const fetcher = useFetcher();
  return (
    <div className="w-full overflow-hidden bg-grey-100 pb-5">
      <Head>Ваши записи</Head>
      <div className="flex justify-center">
        <FileTable entries={entries} error={entryError} />
      </div>
      <div className="flex flex-col gap-1 mx-8">
        <fetcher.Form method="post" encType="multipart/form-data">
          <input type="file" name="file" required />
          <button type="submit" disabled={fetcher.state !== "idle"}>
            {fetcher.state === "idle" ? "Upload" : "Uploading..."}
          </button>
        </fetcher.Form>
        {fetcher.data?.error && (
          <p className="text-red-500">{fetcher.data.error}</p>
        )}
        {fetcher.data?.success && (
          <p className="text-green-500">Uploaded! URL: {fetcher.data.url}</p>
        )}
      </div>
    </div>
  );
};

export default data;
