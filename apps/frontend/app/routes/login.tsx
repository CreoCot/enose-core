import { motion } from "motion/react";
import { Link, redirect, useFetcher } from "react-router";
import type { Route } from "./+types/login";
import api from "../axios";
import { isAxiosError, type AxiosError } from "axios";
import { useEffect, useState } from "react";

export async function clientAction({ request }: Route.ClientActionArgs) {
  const formData = await request.formData();
  const username = formData.get("username") as string;
  const password = formData.get("password") as string;
  const rememberMe = formData.get("remember_me") !== null;
  try {
    await api.post("/api/v1/auth/login", {
      username,
      password,
      remember_me: rememberMe,
      
    });
    return redirect("/data");
  } catch (error) {
    if (isAxiosError(error) && error.response) {
      if (error.response.data.error) {
        return { error: error.response.data.message };
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

const login = () => {
  const fetcher = useFetcher();
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setError(fetcher.data?.error);
  }, [fetcher.data]);
  return (
    <div className="flex w-full max-w-screen h-full min-h-screen bg-primary-900">
      <div className="absolute">
        <Link
          to="/"
          className="flex items-center justify-center m-3 w-11 h-7 rounded-[10px] font-medium text-base lg:text-lg text-grey-900 hover:text-primary-700 hover:font-bold transition-all duration-150"
        >
          На домашнюю
        </Link>
      </div>
      <div className="flex flex-col w-18 bg-white py-11 px-9 sm:px-10 xl:px-11 2xl:px-12">
        <h3 className="text-sm lg:text-base text-accent-500 font-mono font-light tracking-wide transition-all">
          ЕДИНЫЙ ИНТЕРФЕЙС ЭЛЕКТРОННОГО НОСА
        </h3>
        <h2 className="text-grey-900 text-2xl lg:text-3xl font-bold leading-none pt-2">
          Войдите, чтобы начать работу
        </h2>
        <fetcher.Form method="post" className="w-full relative">
          <div className="flex flex-col gap-4 pt-6">
            <div className="pb-2">
              <h4 className="font-mono text-lg text-grey-800">Логин</h4>
              <motion.input
                required
                initial={{ y: 2 }}
                whileFocus={{ y: -1 }}
                className="bg-primary-100 rounded-[15px] w-full p-2 px-3 border text-base outline outline-primary-200 focus:outline-primary-500 focus:shadow-xl transition-colors"
                type="text"
                name="username"
              />
            </div>
            <div className="pb-2">
              <h4 className="font-mono text-lg text-grey-800">Пароль</h4>

              <motion.input
                required
                initial={{ y: 2 }}
                whileFocus={{ y: -1 }}
                className="bg-primary-100 rounded-[15px] w-full p-2 px-3 border text-base outline outline-primary-200 focus:outline-primary-500 focus:shadow-xl transition-colors"
                type="password"
                name="password"
              />
            </div>
            <div className="text-grey-700">
              Нет аккаунта?
              <Link
                className="text-primary-700 px-2 font-semibold"
                to="/signup"
              >
                Зарегистрируйтесь
              </Link>
            </div>
            <div className="flex gap-2 text-grey-600">
              <input
                className="bg-white disabled:cursor-not-allowed"
                name="remember_me"
                type="checkbox"
              />
              Запомнить меня
            </div>

            <motion.button
              onClick={() => setError(null)}
              disabled={fetcher.state === "submitting"}
              type="submit"
              whileHover={{ y: -1 }}
              whileTap={{ y: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 10 }}
              className={`text-center p-2 px-3 text-lg font-semibold text-primary-100 bg-primary-600 hover:bg-primary-700 transition-colors duration-100 rounded-[15px] cursor-pointer  ${
                error && "outline outline-red-600"
              }`}
            >
              Вход
            </motion.button>
          </div>
          {error && (
            <motion.div
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.3, ease: "easeIn" }}
              className="text-red-600 text-base font-light px-2 pt-1 absolute bottom-0 translate-y-full"
            >
              {error}
            </motion.div>
          )}
        </fetcher.Form>
      </div>
      <div className="hidden md:flex w-full bg-radial from-primary-600/90 to-accent-800/80">
        <div className="w-full bg-accent-300/40 mask-[url('../topography.svg')] mask-repeat mask-size-[500px_500px]" />
      </div>
    </div>
  );
};

export default login;
