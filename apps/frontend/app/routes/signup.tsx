import { motion } from "motion/react";
import { Link, redirect, useFetcher } from "react-router";
import Select, { type SelectChangeEvent } from "@mui/material/Select";
import { useEffect, useState } from "react";
import MenuItem from "@mui/material/MenuItem";
import type { Route } from "./+types/signup";
import api from "../axios";
import { isAxiosError } from "axios";

export async function clientAction({ request }: Route.ClientActionArgs) {
  const formData = await request.formData();
  const password = formData.get("password");
  const confirmPassword = formData.get("confirmPassword");
  if (password !== confirmPassword) {
    return { error: "Пароли не сопадают" };
  }
  const username = formData.get("username");
  const email = formData.get("email");
  const fullName = formData.get("full_name");
  const role = formData.get("role");
  const rememberMe = formData.get("remember_me") !== null;
  try {
    await api.post("/api/v1/auth/register", {
      username,
      email,
      full_name: fullName,
      role,
      remember_me: rememberMe,
      password,
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
      return "Что-то пошло не так";
    }
  }
}

const signup = () => {
  const fetcher = useFetcher();
  const [role, setRole] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [passwordsEqual, setPasswordsEqual] = useState(true);
  useEffect(() => {
    setError(fetcher.data?.error);
  }, [fetcher.data]);
  const handleChange = (event: SelectChangeEvent) => {
    setRole(event.target.value);
  };
  return (
    <div className="flex w-full max-w-screen h-full min-h-screen bg-primary-900">
      <Link
        to="/"
        className="flex absolute items-center justify-center m-3 w-11 h-7 rounded-[10px] font-medium text-base lg:text-lg text-grey-900 hover:text-primary-700 hover:font-bold transition-all duration-150 z-10"
      >
        На домашнюю
      </Link>
      <div className="flex flex-col w-18 justify-center bg-white py-9 px-9 sm:px-10 xl:px-11 2xl:px-12">
        <h2 className="text-sm lg:text-base text-accent-500 font-mono font-light tracking-wide transition-all">
          ЕДИНЫЙ ИНТЕРФЕЙС ЭЛЕКТРОННОГО НОСА
        </h2>
        <h3 className="text-grey-900 text-2xl lg:text-3xl font-bold leading-none pt-2">
          Зарегистрируйтесь, чтобы начать работу
        </h3>
        <fetcher.Form method="post" className="w-full relative">
          <div className="flex flex-col gap-3 pt-6">
            <div className="pb-2">
              <h4 className="font-mono text-lg text-grey-800">Логин</h4>
              <motion.input
                required
                initial={{ y: 2 }}
                whileFocus={{ y: -1 }}
                className="bg-primary-100 rounded-[15px] w-full p-2 px-3 text-base outline outline-primary-200 focus:outline-primary-500 focus:shadow-xl transition-colors"
                type="text"
                name="username"
              />
            </div>
            <div className="pb-2">
              <h4 className="font-mono text-lg text-grey-800">Email</h4>
              <motion.input
                required
                initial={{ y: 2 }}
                whileFocus={{ y: -1 }}
                className="bg-primary-100 rounded-[15px] w-full p-2 px-3 text-base outline outline-primary-200 focus:outline-primary-500 focus:shadow-xl transition-colors"
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
                className="bg-primary-100 rounded-[15px] w-full p-2 px-3 text-base outline outline-primary-200 focus:outline-primary-500 focus:shadow-xl transition-colors"
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
                onChange={(event) => {
                  const form = event.currentTarget.form;
                  if (!form) return;
                  const formData = new FormData(form);
                  const password = formData.get("password");
                  const confirmPassword = formData.get("confirmPassword");
                  if (
                    password &&
                    confirmPassword &&
                    password === confirmPassword
                  ) {
                    setPasswordsEqual(true);
                  } else if (!password || !confirmPassword) {
                    setPasswordsEqual(true);
                  } else {
                    setPasswordsEqual(false);
                  }
                }}
                className="bg-primary-100 rounded-[15px] w-full p-2 px-3 text-base outline outline-primary-200 focus:outline-primary-500 focus:shadow-xl transition-colors"
                type="password"
                name="password"
              />
            </div>
            <div className="pb-2">
              <h4 className="font-mono text-lg text-grey-800">
                Подтвердите пароль
              </h4>

              <motion.input
                required
                initial={{ y: 2 }}
                whileFocus={{ y: -1 }}
                onChange={(event) => {
                  const form = event.currentTarget.form;
                  if (!form) return;
                  const formData = new FormData(form);
                  const password = formData.get("password");
                  const confirmPassword = formData.get("confirmPassword");
                  if (
                    password &&
                    confirmPassword &&
                    password === confirmPassword
                  ) {
                    setPasswordsEqual(true);
                  } else if (!password || !confirmPassword) {
                    setPasswordsEqual(true);
                  } else {
                    setPasswordsEqual(false);
                  }
                }}
                className={`bg-primary-100 rounded-[15px] w-full p-2 px-3 text-base outline  ${
                  passwordsEqual
                    ? "outline-primary-200 focus:outline-primary-500"
                    : "outline-red-600"
                } focus:shadow-xl transition-colors`}
                type="password"
                name="confirmPassword"
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
              <input
                // disabled
                name="remember_me"
                className="bg-white cursor-not-allowed"
                type="checkbox"
              />
              Запомнить меня&lt;not done&gt;
            </div>
            <motion.button
              onClick={() => {
                setError(null);
              }}
              disabled={fetcher.state === "submitting"}
              type="submit"
              whileHover={{ y: -1 }}
              whileTap={{ y: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 10 }}
              className={`text-center p-2 px-3 text-lg font-semibold text-primary-100 bg-primary-600 hover:bg-primary-700 transition-colors duration-100 rounded-[15px] cursor-pointer  ${
                error && "outline outline-red-600"
              }`}
            >
              Регистрация
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

export default signup;
