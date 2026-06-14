import DataSection from "../components/DataSection";
import Head from "../components/Head";
import Table from "../components/Table";

const data = () => {
  return (
    <div className="w-full bg-grey-100">
      <Head>Данные с сенсоров</Head>
      <DataSection name="График" />
      <DataSection name="Таблица">
        <Table />
      </DataSection>
    </div>
  );
};

export default data;
