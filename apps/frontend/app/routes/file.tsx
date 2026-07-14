import { useMemo, useState } from "react";
import Head from "../components/Head";
import MeasurementsTable from "../components/MeasurementsTable";
import Plots from "../components/Plots";
import MultiPlot from "../components/MultiPlot";
import axios from "../axios";
import { isAxiosError } from "axios";
import type { Route } from "./+types/file";
import { AnimatePresence, motion, type Variants } from "motion/react";
import { Link } from "react-router";

const tableIcon = (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={1.5}
    stroke="currentColor"
    className="size-6"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 0 1-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5A1.125 1.125 0 0 1 12 18.375m9.75-12.75c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125m19.5 0v1.5c0 .621-.504 1.125-1.125 1.125M2.25 5.625v1.5c0 .621.504 1.125 1.125 1.125m0 0h17.25m-17.25 0h7.5c.621 0 1.125.504 1.125 1.125M3.375 8.25c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m17.25-3.75h-7.5c-.621 0-1.125.504-1.125 1.125m8.625-1.125c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125M12 10.875v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125M13.125 12h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125M20.625 12c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5M12 14.625v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 14.625c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125m0 1.5v-1.5m0 0c0-.621.504-1.125 1.125-1.125m0 0h7.5"
    />
  </svg>
);
const selectedTableIcon = (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="currentColor"
    className="size-6"
  >
    <path
      fillRule="evenodd"
      d="M1.5 5.625c0-1.036.84-1.875 1.875-1.875h17.25c1.035 0 1.875.84 1.875 1.875v12.75c0 1.035-.84 1.875-1.875 1.875H3.375A1.875 1.875 0 0 1 1.5 18.375V5.625ZM21 9.375A.375.375 0 0 0 20.625 9h-7.5a.375.375 0 0 0-.375.375v1.5c0 .207.168.375.375.375h7.5a.375.375 0 0 0 .375-.375v-1.5Zm0 3.75a.375.375 0 0 0-.375-.375h-7.5a.375.375 0 0 0-.375.375v1.5c0 .207.168.375.375.375h7.5a.375.375 0 0 0 .375-.375v-1.5Zm0 3.75a.375.375 0 0 0-.375-.375h-7.5a.375.375 0 0 0-.375.375v1.5c0 .207.168.375.375.375h7.5a.375.375 0 0 0 .375-.375v-1.5ZM10.875 18.75a.375.375 0 0 0 .375-.375v-1.5a.375.375 0 0 0-.375-.375h-7.5a.375.375 0 0 0-.375.375v1.5c0 .207.168.375.375.375h7.5ZM3.375 15h7.5a.375.375 0 0 0 .375-.375v-1.5a.375.375 0 0 0-.375-.375h-7.5a.375.375 0 0 0-.375.375v1.5c0 .207.168.375.375.375Zm0-3.75h7.5a.375.375 0 0 0 .375-.375v-1.5A.375.375 0 0 0 10.875 9h-7.5A.375.375 0 0 0 3 9.375v1.5c0 .207.168.375.375.375Z"
      clipRule="evenodd"
    />
  </svg>
);
const plotIcon = (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={1.5}
    stroke="currentColor"
    className="size-6"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M7.5 14.25v2.25m3-4.5v4.5m3-6.75v6.75m3-9v9M6 20.25h12A2.25 2.25 0 0 0 20.25 18V6A2.25 2.25 0 0 0 18 3.75H6A2.25 2.25 0 0 0 3.75 6v12A2.25 2.25 0 0 0 6 20.25Z"
    />
  </svg>
);
const selectedPlotIcon = (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="currentColor"
    className="size-6"
  >
    <path
      fillRule="evenodd"
      d="M3 6a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V6Zm4.5 7.5a.75.75 0 0 1 .75.75v2.25a.75.75 0 0 1-1.5 0v-2.25a.75.75 0 0 1 .75-.75Zm3.75-1.5a.75.75 0 0 0-1.5 0v4.5a.75.75 0 0 0 1.5 0V12Zm2.25-3a.75.75 0 0 1 .75.75v6.75a.75.75 0 0 1-1.5 0V9.75A.75.75 0 0 1 13.5 9Zm3.75-1.5a.75.75 0 0 0-1.5 0v9a.75.75 0 0 0 1.5 0v-9Z"
      clipRule="evenodd"
    />
  </svg>
);
const multiPlotIcon = (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={1.5}
    stroke="currentColor"
    className="size-6"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z"
    />
  </svg>
);
const selectedMultiPlotIcon = (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="currentColor"
    className="size-6"
  >
    <path d="M18.375 2.25c-1.035 0-1.875.84-1.875 1.875v15.75c0 1.035.84 1.875 1.875 1.875h.75c1.035 0 1.875-.84 1.875-1.875V4.125c0-1.036-.84-1.875-1.875-1.875h-.75ZM9.75 8.625c0-1.036.84-1.875 1.875-1.875h.75c1.036 0 1.875.84 1.875 1.875v11.25c0 1.035-.84 1.875-1.875 1.875h-.75a1.875 1.875 0 0 1-1.875-1.875V8.625ZM3 13.125c0-1.036.84-1.875 1.875-1.875h.75c1.036 0 1.875.84 1.875 1.875v6.75c0 1.035-.84 1.875-1.875 1.875h-.75A1.875 1.875 0 0 1 3 19.875v-6.75Z" />
  </svg>
);
const downloadIcon = (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={1.5}
    stroke="currentColor"
    className="size-5 lg:size-6"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3"
    />
  </svg>
);

export async function clientLoader({ params }: Route.ClientLoaderArgs) {
  const fileId = Number(params.fileId);
  let sensorSize = 0;

  let table: number[][] = [],
    tableError: string = "";
  try {
    const tableResponse = await axios.get(`/api/v1/table/${fileId}`);
    if (!tableResponse.data.data || !tableResponse.data.size) {
      tableError = "Ошибка API";
    }
    table = tableResponse.data.data || [];
    if (sensorSize === 0) sensorSize = tableResponse.data.size;
  } catch (error) {
    if (isAxiosError(error) && error.response) {
      if (error.response.data.error) {
        tableError = error.response.data.error;
      } else {
        tableError = error.response.data;
      }
    } else if (error instanceof Error) {
      tableError = error.message;
    } else {
      tableError = "Что-то пошло не так";
    }
  }
  let plots: number[][] = [],
    plotTimestamps: number[] = [],
    plotError: string = "";
  try {
    const plotResponse = await axios.get(`/api/v1/plots/${fileId}`);
    if (
      !plotResponse.data.data ||
      !plotResponse.data.size ||
      !plotResponse.data.timestamps
    ) {
      plotError = "Ошибка API";
      return;
    }
    plotTimestamps = plotResponse.data.timestamps;
    plots = plotResponse.data.data;
    if (sensorSize === 0) sensorSize = plotResponse.data.size;
  } catch (error) {
    if (isAxiosError(error) && error.response) {
      if (error.response.data.error) {
        plotError = error.response.data.error;
      } else {
        plotError = error.response.data;
      }
    } else if (error instanceof Error) {
      plotError = error.message;
    } else {
      plotError = "Что-то пошло не так";
    }
  }
  return {
    sensorSize,
    table,
    tableError,
    plots,
    plotTimestamps,
    plotError,
    fileId,
  };
}
const HydrationText = () => {
  const containerVariants = {
    initial: { opacity: 1 },
    animate: {
      transition: {
        staggerChildren: 0.2,
      },
    },
  };

  const dotVariants: Variants = {
    initial: { opacity: 0 },
    animate: {
      opacity: 1,
      transition: {
        duration: 0.7,
        repeat: Infinity,
        repeatType: "reverse",
        ease: "easeInOut",
      },
    },
  };
  return (
    <motion.div
      className="text-primary-700 font-bold text-2xl lg:text-3xl mx-8 my-4"
      variants={containerVariants}
      initial="initial"
      animate="animate"
    >
      Получаем данные
      <motion.span variants={dotVariants}>.</motion.span>
      <motion.span variants={dotVariants}>.</motion.span>
      <motion.span variants={dotVariants}>.</motion.span>
    </motion.div>
  );
};
export function HydrateFallback() {
  return (
    <div className="w-full overflow-hidden bg-grey-50 pb-5">
      <Head>Запись №</Head>
      <div className="flex flex-col pt-5 pl-6 text-2xl lg:text-3xl px-6">
        <div className="flex w-fit bg-grey-600 justify-between gap-1 p-1 rounded-full mx-7 text-grey-100">
          <button
            className={`bg-grey-300 text-gray-700 hover:bg-grey-200 hover:text-gray-800 transition-colors duration-150 rounded-full p-1 px-4`}
          >
            <div className="flex items-center gap-1">
              {selectedPlotIcon}
              Графики
            </div>
          </button>
          <button
            className={`bg-grey-600 hover:bg-grey-200 hover:text-gray-800 transition-colors duration-150 rounded-full p-1 px-4`}
          >
            <div className="flex items-center gap-1">
              {tableIcon}
              Таблица
            </div>
          </button>
        </div>
      </div>
      <HydrationText />
    </div>
  );
}

const handleDownload = async (
  fileId: number,
  setError: (arg0: string) => void,
) => {
  try {
    const response = await axios.get(`/api/v1/report/${fileId}`, {
      responseType: "blob",
    });
    const contentDisposition = response.headers["content-disposition"];
    let filename = `report-${fileId}.pdf`;
    if (contentDisposition && contentDisposition.includes("filename=")) {
      filename = contentDisposition.split("filename=")[1].replace(/["']/g, "");
    }
    const blobUrl = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement("a");
    link.href = blobUrl;
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    link.parentNode?.removeChild(link);
    window.URL.revokeObjectURL(blobUrl);
    return { success: true };
  } catch (error) {
    if (isAxiosError(error) && error.response) {
      if (error.response.data instanceof Blob) {
        try {
          const textError = await error.response.data.text();

          const jsonError = JSON.parse(textError);
          setError(
            jsonError.message ||
              jsonError.error ||
              `Ошибка: ${error.response.status}`,
          );
        } catch {
          setError(
            `Ошибка сервера: ${error.response.status} ${error.response.statusText}`,
          );
        }
      } else {
        setError("Не удалось обработать ответ сервера");
      }
    } else if (error instanceof Error) {
      setError(error.message);
    } else {
      setError("Что-то пошло не так");
    }
  }
};

const file = ({ loaderData }: Route.ComponentProps) => {
  const {
    sensorSize = 0,
    table = [],
    tableError = "",
    plots = [],
    plotTimestamps = [],
    plotError = "",
    fileId = -1,
  } = loaderData || {};

  const [open, setOpen] = useState(1);
  const [downloadError, setDownloadError] = useState("");
  const icons = useMemo(() => {
    return [
      [tableIcon, plotIcon, multiPlotIcon, downloadIcon],
      [
        selectedTableIcon,
        selectedPlotIcon,
        selectedMultiPlotIcon,
        downloadIcon,
      ],
    ];
  }, []);
  const items = [
    useMemo(() => {
      return (
        <motion.div
          key="table"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          transition={{ duration: 0.15 }}
        >
          <MeasurementsTable
            table={table}
            sensorSize={sensorSize}
            error={tableError}
          />
        </motion.div>
      );
    }, [table, tableError, sensorSize]),
    useMemo(() => {
      return (
        <motion.div
          key="plots"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          transition={{ duration: 0.15 }}
        >
          <Plots
            data={plots}
            timestamps={plotTimestamps}
            sensorSize={sensorSize}
            error={plotError}
          />
        </motion.div>
      );
    }, [plots, plotTimestamps, plotError, sensorSize]),
    useMemo(() => {
      return (
        <motion.div
          key="multiPlots"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          transition={{ duration: 0.15 }}
        >
          <MultiPlot
            timestamps={plotTimestamps}
            sensorData={plots}
            sensorSize={sensorSize}
            error={plotError}
          />
        </motion.div>
      );
    }, [plots, plotTimestamps, plotError, sensorSize]),
  ];
  return (
    <div className="w-full overflow-hidden bg-grey-50 pb-5">
      <Head>{`Запись №${fileId}`}</Head>
      <Link
        className="flex gap-1 items-center w-fit lg:text-lg text-grey-700 hover:text-grey-600 mx-7 mt-5 transition-colors duration-200"
        to="/data"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 27 27"
          strokeWidth={0.9}
          stroke="currentColor"
          className="size-6"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M6.75 15.75 3 12m0 0 3.75-3.75M3 12h18"
          />
        </svg>

        <span>Назад</span>
      </Link>
      <div className="flex flex-col pt-3 text-xl lg:text-2xl px-6">
        <div className="flex flex-col lg:flex-row w-fit bg-grey-600 justify-between gap-1 p-2 lg:p-1 rounded-[15px] lg:rounded-full sm:mx-7 text-grey-100">
          <button
            className={`${
              open === 2 ? "bg-grey-300 text-gray-700" : "bg-grey-600"
            } hover:bg-grey-200 hover:text-gray-800 transition-colors duration-150 rounded-full p-1 px-4`}
            onClick={() => setOpen(2)}
          >
            <div className="flex items-center gap-1">
              {open === 2 ? icons[1][2] : icons[0][2]}
              Сравнение
            </div>
          </button>
          <button
            className={`${
              open === 1 ? "bg-grey-300 text-gray-700" : "bg-grey-600"
            } hover:bg-grey-200 hover:text-gray-800 transition-colors duration-150 rounded-full p-1 px-4`}
            onClick={() => setOpen(1)}
          >
            <div className="flex items-center gap-1">
              {open === 1 ? icons[1][1] : icons[0][1]}
              Графики
            </div>
          </button>
          <button
            className={`${
              open === 0 ? "bg-grey-300 text-gray-700" : "bg-grey-600"
            } hover:bg-grey-200 hover:text-gray-800 transition-colors duration-150 rounded-full p-1 px-4`}
            onClick={() => setOpen(0)}
          >
            <div className="flex items-center gap-1">
              {open === 0 ? icons[1][0] : icons[0][0]}
              Таблица
            </div>
          </button>
          <div className="relative">
            <AnimatePresence mode="wait">
              {downloadError.length !== 0 && (
                <motion.p
                  initial={{ y: -20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: -20, opacity: 0 }}
                  transition={{ duration: 0.15, ease: "easeIn" }}
                  className="absolute my-2 -top-1/2 rounded-[15px] p-2 right-1/2 translate-x-1/2 -translate-y-full text-lg text-red-600 bg-red-100 border border-red-800 w-max"
                >
                  {downloadError}
                  <button
                    className="text-grey-600 pl-2 font-light cursor-pointer"
                    onClick={() => setDownloadError("")}
                  >
                    X
                  </button>
                </motion.p>
              )}
            </AnimatePresence>
            <button
              id="download"
              onClick={() => {
                setDownloadError("");
                handleDownload(fileId, setDownloadError);
              }}
              className={`bg-grey-600 hover:bg-grey-200 hover:text-gray-800 transition-colors duration-150 rounded-full p-1 px-4 ${
                downloadError.length !== 0 ? "outline outline-red-700" : ""
              }`}
            >
              <div className="flex items-center gap-1">
                Отчет
                {icons[0][3]}
              </div>
            </button>
          </div>
        </div>
        <AnimatePresence mode="wait">{items[open]}</AnimatePresence>
      </div>
    </div>
  );
};

export default file;
