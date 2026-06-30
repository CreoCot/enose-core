import { useEffect, useMemo, useState } from "react";
import DataSection from "../components/DataSection";
import Head from "../components/Head";
import MeasurementsTable from "../components/MeasurementsTable";
import Plots from "../components/Plots";
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

export async function clientLoader({ params }: Route.ClientLoaderArgs) {
  const fileId = Number(params.fileId);
  let sensorSize = 0;

  let table: number[][] = [],
    tableError: string = "";
  try {
    const tableResponse = await axios.get("/api/v1/table");
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
    const plotResponse = await axios.get("/api/v1/plots");
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
  ];
  const len = items.length;
  return (
    <div className="w-full overflow-hidden bg-grey-50 pb-5">
      <Head>{`Запись №${fileId + 1}`}</Head>
      <Link
        className="flex gap-1 items-center lg:text-lg text-grey-700 hover:text-grey-600 mx-7 mt-5"
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
      <div className="flex flex-col pt-3 text-2xl lg:text-3xl px-6">
        <div className="flex w-fit bg-grey-600 justify-between gap-1 p-1 rounded-full mx-7 text-grey-100">
          <button
            className={`${
              open === 1 ? "bg-grey-300 text-gray-700" : "bg-grey-600"
            } hover:bg-grey-200 hover:text-gray-800 transition-colors duration-150 rounded-full p-1 px-4`}
            onClick={() => setOpen(1)}
          >
            <div className="flex items-center gap-1">
              {open === 1 ? selectedPlotIcon : plotIcon}
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
              {open === 0 ? selectedTableIcon : tableIcon}
              Таблица
            </div>
          </button>
        </div>
        <AnimatePresence mode="wait">{items[open]}</AnimatePresence>
      </div>
    </div>
  );
};

export default file;
