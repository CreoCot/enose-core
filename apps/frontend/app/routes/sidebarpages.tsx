import { Outlet, redirect } from "react-router";
import ResponsiveSidebar from "../components/ResponsiveSidebar";
import api from "../axios";
import type { LoaderFunctionArgs } from "react-router";

export async function clientLoader() {
  try {
    await api.get("/api/v1/auth/me");
  } catch (error) {
    if (error instanceof Error) console.log("HERE2", error.message);
    throw redirect("/login");
  }
}
export function HydrateFallback() {
  return (
    <div className="flex w-full h-full min-h-screen">
      <ResponsiveSidebar />
      <div className="w-full overflow-hidden bg-grey-100 pb-5" />
    </div>
  );
}
export const sidebarpages = () => {
  return (
    <div className="flex w-full h-full min-h-screen">
      <ResponsiveSidebar />
      <Outlet />
    </div>
  );
};

export default sidebarpages;
