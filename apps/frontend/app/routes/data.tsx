import Head from "../components/Head";
import FileTable from "../components/FileTable";
import type { Route } from "./+types/data";
import axios from "../axios";
import { isAxiosError } from "axios";
import {
  useActionData,
  useFetcher,
  type ClientActionFunctionArgs,
} from "react-router";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState, type ChangeEvent } from "react";
import Toast from "../components/Toast";

export type Entry = {
  id: number;
  name: string;
  date: string;
};
export async function clientLoader() {
  let entries: Entry[] = [],
    entryError: string = "";
  try {
    const response = await axios.get("/api/v1/entries");
    if (!response.data) entryError = "Ошибка API";
    entries = response.data;
    return { entries, entryError };
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
    return { entries: [], entryError };
  }
}

export const clientAction = async ({ request }: ClientActionFunctionArgs) => {
  const formData = await request.formData();
  if (formData.get("file")) {
    const file = formData.get("file") as File | null;
    if (!file || file.size === 0) {
      return { uploadError: "No file provided" };
    }

    const uploadData = new FormData();
    uploadData.append("file", file);
    try {
      const response = await axios.post("/api/v1/upload", uploadData);
      return { success: true, url: response.data.url };
    } catch (error) {
      return { uploadError: "Upload failed" };
    }
  } else if (formData.get("deleteEntry")) {
    try {
      const response = await axios.delete(
        `/api/v1/delete/${formData.get("deleteEntry")}`,
      );
      return { success: true, url: response.data.url };
    } catch (error) {
      if (isAxiosError(error) && error.response) {
        if (error.response.data.error) {
          return { deleteError: error.response.data.message };
        } else {
          return { deleteError: error.response.data };
        }
      } else if (error instanceof Error) {
        return { deleteError: error.message };
      } else {
        return { deleteError: "Что-то пошло не так" };
      }
    }
  }
};

export function HydrateFallback() {
  <div className="flex justify-center">
    <FileTable entries={[]} error={""} fetcher={null} />
  </div>;
}

const data = ({ loaderData }: Route.ComponentProps) => {
  const { entries = [], entryError = "" } = loaderData || {};
  const fetcher = useFetcher();
  const [formData, setFormData] = useState({
    file: "",
  });
  const [toastOpen, setToastOpen] = useState(false);
  const handleCloseToast = () => {
    setToastOpen(false);
    fetcher.reset();
  };
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };
  const deleteError = fetcher.data?.deleteError;
  useEffect(() => {
    setToastOpen(true);
  }, [deleteError]);
  const isFileEmpty = formData.file === "";
  return (
    <div className="w-full overflow-hidden bg-grey-50 pb-5 relative">
      <Head>Ваши записи</Head>
      <AnimatePresence>
        {deleteError && toastOpen && (
          <Toast onClose={handleCloseToast}>
            {`Ошибка при удалении измерения: ${deleteError}`}
          </Toast>
        )}
      </AnimatePresence>
      <div className="flex justify-center">
        <FileTable entries={entries} error={entryError} fetcher={fetcher} />
      </div>
      <div className="flex flex-col gap-1 mx-8">
        <fetcher.Form
          className="w-full"
          method="post"
          encType="multipart/form-data"
        >
          <div className="flex items-center justify-center w-full">
            <label
              htmlFor="dropzone-file"
              className="flex flex-col items-center justify-center w-full h-64 border-primary-400 bg-neutral-secondary-medium border-dashed border-2 rounded-[20px] cursor-pointer hover:bg-neutral-tertiary-medium"
            >
              <div className="flex flex-col items-center justify-center text-primary-700 pt-5 pb-6">
                <svg
                  className="w-8 h-8 mb-4"
                  aria-hidden="true"
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M15 17h3a3 3 0 0 0 0-6h-.025a5.56 5.56 0 0 0 .025-.5A5.5 5.5 0 0 0 7.207 9.021C7.137 9.017 7.071 9 7 9a4 4 0 1 0 0 8h2.167M12 19v-9m0 0-2 2m2-2 2 2"
                  />
                </svg>
                <p
                  className={`mb-2 text-base ${
                    fetcher.data?.uploadError ? "text-red-700" : ""
                  }`}
                >
                  {fetcher.data?.uploadError || (
                    <>
                      <span className="font-semibold">Нажмите</span>, чтобы
                      загрузить файл или перетяните его в окно
                    </>
                  )}
                </p>
                <p className="text-xs">XML, CSV или XLSX</p>
                <motion.button
                  whileHover={{ y: -1 }}
                  whileTap={{ y: 1 }}
                  transition={{ type: "spring", stiffness: 300, damping: 10 }}
                  className={`${
                    isFileEmpty ? "hidden" : ""
                  } mt-4 text-center py-2 px-6 text-lg text-primary-100 bg-primary-600 hover:bg-primary-600 transition-colors duration-100 rounded-[15px] cursor-pointer`}
                  type="submit"
                  onClick={() => {
                    setFormData({ file: "" });
                  }}
                  disabled={fetcher.state === "submitting"}
                >
                  {fetcher.state === "submitting"
                    ? "Загружаем..."
                    : "Загрузить"}
                </motion.button>
              </div>
              <input
                id="dropzone-file"
                type="file"
                name="file"
                className="hidden"
                onChange={handleChange}
                accept=".xml,.csv,.xlsx,application/xml,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              />
            </label>
          </div>
        </fetcher.Form>
      </div>
    </div>
  );
};

export default data;
