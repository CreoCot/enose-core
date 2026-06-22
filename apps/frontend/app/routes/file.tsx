import { useEffect, useState } from "react";
import DataSection from "../components/DataSection";
import Head from "../components/Head";
import Table from "../components/Table";
import Plots from "../components/Plots";
import axios from "../axios";
import { isAxiosError } from "axios";
import type { Route } from "./+types/data";
import { motion, type Variants } from "motion/react";

export async function clientLoader() {
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
  return { sensorSize, table, tableError, plots, plotTimestamps, plotError };
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
    <div className="w-full overflow-hidden bg-grey-100 pb-5">
      <Head>Данные с сенсоров</Head>
      <DataSection initialOpen={true} name="Графики">
        <HydrationText />
      </DataSection>
      <DataSection name="Таблица">
        <HydrationText />
      </DataSection>
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
  } = loaderData || {};
  return (
    <div className="w-full overflow-hidden bg-grey-100 pb-5">
      <Head>Данные с сенсоров</Head>
      <DataSection initialOpen={true} name="Графики">
        <Plots
          data={plots}
          timestamps={plotTimestamps}
          sensorSize={sensorSize}
          error={plotError}
        />
      </DataSection>
      <DataSection name="Таблица">
        <Table table={table} sensorSize={sensorSize} error={tableError} />
      </DataSection>
    </div>
  );
};

export default file;
