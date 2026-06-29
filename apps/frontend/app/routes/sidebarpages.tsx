import { Outlet, redirect } from "react-router";
import ResponsiveSidebar from "../components/ResponsiveSidebar";
import api from "../axios";

export async function loader() {
  try {
    await api.get("/auth/me", { skipAuthRedirect: true } as any);
    return null;
  } catch {
    throw redirect("/login");
  }
}

const sidebarpages = () => {
  return (
    <div className="flex w-full h-full min-h-screen">
      <ResponsiveSidebar />
      <Outlet />
    </div>
  );
};

export default sidebarpages;
