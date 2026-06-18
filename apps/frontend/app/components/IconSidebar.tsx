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
    <div className="flex flex-col bg-grey-200 border-r border-r-grey-300 w-8">
      <div
        className={`flex h-8 border-b border-grey-300 justify-center items-center ${
          isHomeActive ? activeClass : ""
        }`}
      >
        <SidebarButton to="/" type="home" />
      </div>

      <div
        className={`flex justify-center items-baseline ${
          isDataActive ? activeClass : ""
        }`}
      >
        <SidebarButton to="/data" type="data" />
      </div>
    </div>
  );
};

export default Sidebar;
