import { useMatch, useResolvedPath } from "react-router";
import SidebarButton from "./SidebarButton";

function useIsActive(to: string) {
  const resolvedPath = useResolvedPath(to);
  return !!useMatch({ path: resolvedPath.pathname, end: true });
}

const Sidebar = () => {
  const isHomeActive = useIsActive("/");
  const isDataActive = useIsActive("/data");

  const activeClass =
    "relative after:absolute after:right-0 after:top-0 after:bottom-0 after:w-1 after:bg-accent-700";

  return (
    <div className="flex flex-col bg-grey-200 border-r border-r-grey-300 min-h-screen w-12">
      <div
        className={`flex h-8 border-b border-grey-300 justify-center ${
          isHomeActive ? activeClass : "items-baseline"
        }`}
      >
        <SidebarButton to="/" type="home">
          Главная
        </SidebarButton>
      </div>

      <div
        className={`flex justify-center items-baseline ${
          isDataActive ? activeClass : "items-baseline"
        }`}
      >
        <SidebarButton to="/data" type="data">
          Данные
        </SidebarButton>
      </div>
    </div>
  );
};

export default Sidebar;
