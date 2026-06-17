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
      setTable(response.data.data || []);
      setSensorSize(response.data.size);
    } catch (error) {
      if (isAxiosError(error) && error.response) {
        setTableError(error.response.data.error);
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
      setPlotTimestamps(response.data.timestamps);
      setPlots(response.data.data);
      setSensorSize(response.data.size);
    } catch (error) {
      if (isAxiosError(error) && error.response) {
        setPlotError(error.response.data.error);
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
