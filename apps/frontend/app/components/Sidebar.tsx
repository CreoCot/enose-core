import { redirect, useMatch, useNavigate, useResolvedPath } from "react-router";
import SidebarButton from "./SidebarButton";
import api from "../axios";
import { useState } from "react";

function useIsActive(to: string) {
  const resolvedPath = useResolvedPath(to);
  return !!useMatch({ path: resolvedPath.pathname, end: true });
}

interface Props {
  login: string;
}

const Sidebar = ({ login }: Props) => {
  const isHomeActive = useIsActive("/");
  const isDataActive = useIsActive("/data");
  const isProfileActive = useIsActive("/profile");

  const [error, setError] = useState(false);

  const navigate = useNavigate();

  const activeClass =
    "relative after:absolute after:right-0 after:top-0 after:bottom-0 after:w-1 after:bg-accent-700";

  return (
    <div className="flex flex-col justify-between bg-grey-100 border-r border-r-grey-200 w-11 xl:w-12">
      <div className="flex flex-col">
        <div
          className={`flex h-8 border-b border-grey-300 justify-center items-center ${
            isHomeActive ? activeClass : ""
          }`}
        >
          <SidebarButton to="/" type="home">
            Главная
          </SidebarButton>
        </div>

        <div
          className={`flex justify-center items-baseline ${
            isDataActive ? activeClass : ""
          }`}
        >
          <SidebarButton to="/data" type="data">
            Данные
          </SidebarButton>
        </div>
      </div>
      <div
        className={`flex items-baseline justify-center py-2 ${
          isProfileActive ? activeClass : ""
        }`}
      >
        <SidebarButton to="/profile" type="profile">
          {login}
        </SidebarButton>
        <div
          className={`flex items-baseline ${
            error
              ? "text-red-600 hover:text-red-700"
              : "text-grey-500 hover:text-grey-700"
          } transition-colors duration-150`}
        >
          <button
            className="cursor-pointer -ml-3"
            onClick={() => {
              try {
                api.post("/api/v1/auth/logout");
                navigate("/login");
              } catch (error) {
                setError(true);
              }
            }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 26 26"
              strokeWidth={1.5}
              stroke="currentColor"
              className="size-5 xl:size-6 translate-y-1/6"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M8.25 9V5.25A2.25 2.25 0 0 1 10.5 3h6a2.25 2.25 0 0 1 2.25 2.25v13.5A2.25 2.25 0 0 1 16.5 21h-6a2.25 2.25 0 0 1-2.25-2.25V15m-3 0-3-3m0 0 3-3m-3 3H15"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
