import { motion } from "motion/react";
import { Link, redirect, useFetcher } from "react-router";
import Select, { type SelectChangeEvent } from "@mui/material/Select";
import { useState } from "react";
import MenuItem from "@mui/material/MenuItem";
import type { Route } from "./+types/signup";
import api from "../axios";

export async function clientAction({ request }: Route.ClientActionArgs) {
  const formData = await request.formData();
  const login = formData.get("login") as string;
  const password = formData.get("password") as string;
  try {
    await api.post("/api/v1/register", {
      login,
      password,
    });
    return redirect("/data");
  } catch (error: any) {
    return {
      error: error.response?.data?.message || "Неверный логин или пароль",
    };
  }
}

const login = () => {
  const fetcher = useFetcher();
  const [role, setRole] = useState("");

  const handleChange = (event: SelectChangeEvent) => {
    setRole(event.target.value);
  };
  return (
    <div className="flex w-full max-w-screen h-screen bg-primary-900">
      <div className="absolute">
        <Link
          to="/"
          className="flex items-center justify-center m-3 w-11 h-7 rounded-[10px] font-medium text-base lg:text-lg text-grey-900 hover:text-primary-700 hover:font-bold transition-all duration-150"
        >
          На домашнюю
        </Link>
      </div>
      <div className="flex flex-col w-18 justify-center bg-white px-9 sm:px-10 xl:px-11 2xl:px-12">
        <h3 className="text-sm lg:text-base text-accent-500 font-mono font-light tracking-wide transition-all">
          ЕДИНЫЙ ИНТЕРФЕЙС ЭЛЕКТРОННОГО НОСА
        </h3>
        <h2 className="text-grey-900 text-2xl lg:text-3xl font-bold leading-none pt-2">
          Зарегистрируйтесь, чтобы начать работу
        </h2>
        <fetcher.Form method="post" className="w-full">
          <div className="flex flex-col gap-3 pt-6">
            <div className="pb-2">
              <h4 className="font-mono text-lg text-grey-800">Логин</h4>
              <motion.input
                required
                initial={{ y: 2 }}
                whileFocus={{ y: -1 }}
                className="bg-primary-100 rounded-[15px] w-full p-2 px-3 border text-base outline outline-primary-200 focus:outline-primary-500 focus:shadow-xl transition-colors"
                type="text"
                name="login"
              />
            </div>
            <div className="pb-2">
              <h4 className="font-mono text-lg text-grey-800">Email</h4>
              <motion.input
                required
                initial={{ y: 2 }}
                whileFocus={{ y: -1 }}
                className="bg-primary-100 rounded-[15px] w-full p-2 px-3 border text-base outline outline-primary-200 focus:outline-primary-500 focus:shadow-xl transition-colors"
                type="email"
                name="email"
              />
            </div>
            <div className="pb-2">
              <h4 className="font-mono text-lg text-grey-800">
                Полное имя (ФИО)
              </h4>
              <motion.input
                required
                initial={{ y: 2 }}
                whileFocus={{ y: -1 }}
                className="bg-primary-100 rounded-[15px] w-full p-2 px-3 border text-base outline outline-primary-200 focus:outline-primary-500 focus:shadow-xl transition-colors"
                type="text"
                name="full_name"
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
            <div className="pb-2">
              <h4 className="font-mono text-lg text-grey-800">Роль</h4>

              <Select
                required
                className="w-full h-7 bg-primary-100"
                labelId="demo-simple-select-outlined-label"
                id="demo-simple-select-outlined"
                value={role}
                onChange={handleChange}
                sx={{
                  borderRadius: "15px",
                  "& .MuiOutlinedInput-notchedOutline": {
                    borderColor: "#cacff7",
                    borderRadius: "15px",
                  },

                  "&:hover .MuiOutlinedInput-notchedOutline": {
                    borderColor: "#cacff7",
                  },

                  "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
                    borderColor: "#4b4bc3",
                    borderWidth: "2px",
                  },
                  "&.Mui-focused": {
                    boxShadow:
                      "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)",
                  },
                }}
                MenuProps={{
                  slotProps: {
                    paper: {
                      sx: {
                        backgroundColor: "#dee3fc",
                        borderRadius: "7px",
                        "& .MuiMenuItem-root": {
                          color: "#3232a4",
                          "&:hover": {
                            backgroundColor: "#cacff7",
                          },
                          "&.Mui-selected": {
                            backgroundColor: "#b6bbf1",
                            color: "#11116a",
                            "&:hover": {
                              backgroundColor: "#8182da",
                            },
                          },
                        },
                      },
                    },
                  },
                }}
                name="role"
              >
                <MenuItem value="operator">Оператор</MenuItem>
                <MenuItem value="admin">Администратор</MenuItem>
              </Select>
            </div>
            <div className="text-grey-700">
              Есть аккаунт?
              <Link className="text-primary-700 px-2 font-semibold" to="/login">
                Вход
              </Link>
            </div>
            <div className="flex gap-2 text-grey-600">
              <input name="remember_me" className="bg-white" type="checkbox" />
              Запомнить меня
            </div>

            <motion.button
              whileHover={{ y: -1 }}
              whileTap={{ y: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 10 }}
              className="text-center p-2 px-3 text-lg font-semibold text-primary-100 bg-primary-600 hover:bg-primary-700 transition-colors duration-100 rounded-[15px] cursor-pointer"
              type="submit"
            >
              Регистрация
            </motion.button>
          </div>
        </fetcher.Form>
      </div>
      <div className="hidden md:flex w-full h-full bg-radial from-primary-600/90 to-accent-800/80">
        <div className="w-full h-full bg-accent-300/40 mask-[url('../topography.svg')] mask-repeat mask-size-[500px_500px]" />
      </div>
    </div>
  );
};

export default login;
