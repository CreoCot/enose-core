import Head from "../components/Head";
import FileTable from "../components/FileTable";

const data = () => {
  return (
    <div className="w-full overflow-hidden bg-grey-100 pb-5">
      <Head>Ваши записи</Head>
      <div className="flex justify-center">
        <FileTable />
      </div>
    </div>
  );
};

export default data;
