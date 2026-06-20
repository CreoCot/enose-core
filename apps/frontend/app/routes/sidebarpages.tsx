import { Outlet } from "react-router";
import ResponsiveSidebar from "../components/ResponsiveSidebar";

const sidebarpages = () => {
  return (
    <div className="flex w-full h-full min-h-screen">
      <ResponsiveSidebar />
      <Outlet />
    </div>
  );
};

export default sidebarpages;
