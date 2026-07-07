import { useMemo } from "react";
import api from "../axios";
import { isAxiosError } from "axios";
import { useLoaderData } from "react-router";
import Head from "../components/Head";

export async function clientLoader() {
  try {
    const response = await api.get("/api/v1/auth/me");
    // const response = {
    //   data: {
    //     username: "login",
    //     role: "admin",
    //     full_name: "Trofimov Andrei Victorovich",
    //     email: "n.shilov@innopolis.university",
    //     count: 0,
    //   },
    // };
    if (
      !response.data.username ||
      !response.data.role ||
      !response.data.full_name ||
      !response.data.email ||
      response.data.count === undefined
    )
      return { error: "Ошибка API" };
    return {
      role: response.data.role,
      fullName: response.data.full_name,
      email: response.data.email,
      entryCount: response.data.count,
    };
  } catch (error) {
    if (isAxiosError(error) && error.response) {
      if (error.response.data.error) {
        return { error: error.response.data.error };
      } else {
        return { error: error.response.data };
      }
    } else if (error instanceof Error) {
      return { error: error.message };
    } else {
      return { error: "Что-то пошло не так" };
    }
  }
}

const profile = () => {
  const userIcon = useMemo(() => {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="currentColor"
        className="size-6"
      >
        <path
          fillRule="evenodd"
          d="M7.5 6a4.5 4.5 0 1 1 9 0 4.5 4.5 0 0 1-9 0ZM3.751 20.105a8.25 8.25 0 0 1 16.498 0 .75.75 0 0 1-.437.695A18.683 18.683 0 0 1 12 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 0 1-.437-.695Z"
          clipRule="evenodd"
        />
      </svg>
    );
  }, []);
  const { role, fullName, email, entryCount, error } = useLoaderData();
  return (
    <div className="w-full overflow-hidden bg-grey-50 pb-5">
      <Head>Профиль</Head>
      <div className="flex flex-col gap-5">
        {!error && (
          <div className="flex p-5 bg-white mx-7 mt-7 text-grey-900 rounded-[15px] items-center gap-2">
            {userIcon}
            <div className="flex flex-col">
              <h1 className="text-lg lg:text-xl text-primary-700 font-semibold">
                {fullName}
              </h1>
              <h2 className="text-base lg:text-lg text-grey-700">{role}</h2>
            </div>
          </div>
        )}
        {error && (
          <div className="flex p-5 bg-white mx-7 mt-7 text-grey-900 rounded-[15px] items-center gap-2">
            <div className="flex flex-col">
              <h1 className="text-lg lg:text-xl text-red-600 font-semibold">
                {error}
              </h1>
            </div>
          </div>
        )}
        {!error && (
          <div className="flex flex-col lg:flex-row mx-7 gap-5 justify-between">
            <div className="flex flex-col bg-white rounded-[15px] px-6 py-5 gap-3 pb-6 w-full">
              <h2 className="text-primary-500 text-base lg:text-lg">Email</h2>
              <p className="text-grey-800 font-bold text-lg lg:text-xl overflow-x-scroll">
                {email}
              </p>
            </div>
            <div className="flex flex-col bg-white rounded-[15px] px-6 py-5 gap-3 pb-6 w-full">
              <h2 className="text-primary-500 text-base lg:text-lg">Роль</h2>
              <p className="text-grey-800 font-bold text-lg lg:text-xl">
                {role}
              </p>
            </div>
            <div className="flex flex-col bg-white rounded-[15px] px-6 py-5 gap-3 pb-6 w-full">
              <h2 className="text-primary-500 text-base lg:text-lg">
                Количество записей
              </h2>
              <p className="text-grey-800 font-bold text-lg lg:text-xl">
                {entryCount}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default profile;
