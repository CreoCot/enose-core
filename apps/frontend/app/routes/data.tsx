import { useEffect, useState } from "react";
import DataSection from "../components/DataSection";
import Head from "../components/Head";
import Table from "../components/Table";
import Plots from "../components/Plots";
import axios from "../axios";
import { isAxiosError } from "axios";

const data = () => {
  const [table, setTable] = useState<number[][]>([]);
  const [tableError, setTableError] = useState("");

  const [plots, setPlots] = useState<number[][]>([]);
  const [plotTimestamps, setPlotTimestamps] = useState<number[]>([]);
  const [plotError, setPlotError] = useState("");

  const [sensorSize, setSensorSize] = useState(0);

  async function getTable() {
    try {
      const response = await axios.get("/api/v1/table");
      if (!response.data.data || !response.data.size) {
        setTableError("Ошибка API");
        return;
      }
      setTable(response.data.data || []);
      if (sensorSize === 0) setSensorSize(response.data.size);
    } catch (error) {
      if (isAxiosError(error) && error.response) {
        if (error.response.data.error) {
          setTableError(error.response.data.error);
        } else {
          setTableError(error.response.data);
        }
      } else if (error instanceof Error) {
        setTableError(error.message);
      } else {
        setTableError("Что-то пошло не так");
      }
    }
  }

  async function getPlots() {
    try {
      const response = await axios.get("/api/v1/plots");
      if (
        !response.data.data ||
        !response.data.size ||
        !response.data.timestamps
      ) {
        setPlotError("Ошибка API");
        return;
      }
      setPlotTimestamps(response.data.timestamps);
      setPlots(response.data.data);
      if (sensorSize === 0) setSensorSize(response.data.size);
    } catch (error) {
      if (isAxiosError(error) && error.response) {
        if (error.response.data.error) {
          setPlotError(error.response.data.error);
        } else {
          setPlotError(error.response.data);
        }
      } else if (error instanceof Error) {
        setPlotError(error.message);
      } else {
        setTableError("Что-то пошло не так");
      }
    }
  }

  useEffect(() => {
    getTable();
  }, []);
  useEffect(() => {
    getPlots();
  }, []);

  return (
    <div className="w-full bg-grey-100 pb-5">
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

export default data;
