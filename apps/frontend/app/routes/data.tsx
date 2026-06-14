import { useEffect, useState } from "react";
import DataSection from "../components/DataSection";
import Head from "../components/Head";
import Table from "../components/Table";
import axios from "../axios";

const data = () => {
  const [table, setTable] = useState<number[][]>([]);
  const [error, setError] = useState("");
  const [sensorSize, setSensorSize] = useState(0);
  async function getTable() {
    try {
      const response = await axios.get("/api/v1/table");
      setTable(response.data.table || []);
      setSensorSize(response.data.length);
    } catch (error) {
      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError("Something went wrong");
      }
    }
  }
  useEffect(() => {
    getTable();
  }, []);
  return (
    <div className="w-full bg-grey-100">
      <Head>Данные с сенсоров</Head>
      <DataSection name="График" />
      <DataSection name="Таблица">
        <Table table={table} sensorSize={sensorSize} error={error} />
      </DataSection>
    </div>
  );
};

export default data;
