import type { Route } from "./+types/home";
import { NavLink } from "react-router";
export function meta({}: Route.MetaArgs) {
  return [
    { title: "New React Router App" },
    { name: "description", content: "Welcome to React Router!" },
  ];
}

export default function Home() {
  return (
    <div className="relative w-full h-screen bg-[radial-gradient(circle_at_center,#070750_0%,#3A147B_35%,#191D34_92%)] flex justify-center">
      <div className="absolute inset-0 bg-[#191D34]/20 pointer-events-none" />
      <div className="flex flex-col max-w-screen gap-9 md:gap-8 items-center w-13 h-13 sm:w-14 sm:h-13 md:w-15 md:h-13 lg:w-16 pt-8 md:pt-8 absolute inset-x-1/2 inset-y-13 -translate-1/2 rounded-[15px] backdrop-blur-xl border-l border-l-primary-200/40 border-r border-r-accent-200/40">
        <div className="absolute inset-0 flex after:absolute after:inset-0 after:rounded-[15px] after:bg-linear-90 after:to-3% after:from-primary-300/7 before:absolute before:inset-0 before:rounded-[15px] before:bg-linear-270 before:to-3% before:from-accent-300/7" />
        <div className="flex flex-col items-center">
          <h1 className="font-mono text-primary-100 text-shadow-lg text-shadow-primary-900 text-3xl sm:text-4xl md:text-5xl font-bold">
            Электронный нос -
          </h1>
          <h2 className="font-mono pt-2 text-primary-300 text-shadow-lg text-shadow-primary-900 text-2xl sm:text-3xl md:text-4xl font-semibold">
            Всегда с вами
          </h2>
        </div>
        <button className="relative flex items-center justify-center w-11 h-7 sm:w-12 sm:h-8 rounded-[10px] shadow-md border border-primary-100/40 border-b-primary-900/40 border-r-primary-900/20 backdrop-blur-lg text-primary-200 text-xl sm:text-2xl font-semibold bg-linear-359 from-93% to-primary-100 after:absolute after:inset-0 after:rounded-[10px] after:bg-linear-179 after:from-93% after:to-primary-900/40">
          <NavLink
            to="/data"
            className="z-10 cursor-pointer absolute inset-0"
          />
          Регистрация
        </button>
      </div>
    </div>
  );
}
