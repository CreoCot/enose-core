import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";

import Sidebar from "./Sidebar";
import IconSidebar from "./IconSidebar";

const ResponsiveSidebar = () => {
  const [smSidebarOpen, setSmSidebarOpen] = useState(false);
  return (
    <>
      <div className="hidden sm:flex sm:h-full sm:min-h-screen">
        <Sidebar />
      </div>
      <div className="flex h-full min-h-screen sm:hidden items-center">
        <AnimatePresence mode="popLayout">
          {smSidebarOpen && (
            <motion.div
              key="full-sidebar"
              layout
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.07 }}
              className="flex absolute h-full"
            >
              <Sidebar />
            </motion.div>
          )}
          {!smSidebarOpen && (
            <motion.div
              key="icon-sidebar"
              layout
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="flex absolute min-h-screen h-full"
            >
              <IconSidebar />
            </motion.div>
          )}
        </AnimatePresence>
        <div className="flex cursor-pointer">
          <motion.svg
            animate={{ rotate: smSidebarOpen ? 180 : 0, x: 0 }}
            transition={{ duration: 0.07, ease: "easeOut" }}
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="hsl(263, 67%, 35%)"
            className={`size-6 bg-grey-200 p-0.5 shadow-xs shadow-grey-300 rounded-2xl ${
              smSidebarOpen ? "ml-11 -translate-x-4" : "ml-7"
            } ${smSidebarOpen ? "-mr-6" : "-mr-4"} z-10`}
            onClick={() => setSmSidebarOpen((open) => !open)}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="m5.25 4.5 7.5 7.5-7.5 7.5m6-15 7.5 7.5-7.5 7.5"
            />
          </motion.svg>
        </div>
      </div>
    </>
  );
};
export default ResponsiveSidebar;
