import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";

import "@fontsource-variable/nunito-sans/index.css";
import type { Route } from "./+types/root";
import "./app.css";
import Sidebar from "./components/Sidebar";
import IconSidebar from "./components/IconSidebar";
import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";

// export const links: Route.LinksFunction = () => [
//   { rel: "preconnect", href: "https://fonts.googleapis.com" },
//   {
//     rel: "preconnect",
//     href: "https://fonts.gstatic.com",
//     crossOrigin: "anonymous",
//   },
//   {
//     rel: "stylesheet",
//     href: "https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap",
//   },
// ];

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  const [smSidebarOpen, setSmSidebarOpen] = useState(false);
  return (
    <div className="bg-grey-200">
      <div className="flex w-full h-full min-h-screen">
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
        <Outlet />
      </div>
    </div>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "Oops!";
  let details = "An unexpected error occurred.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404" : "Error";
    details =
      error.status === 404
        ? "The requested page could not be found."
        : error.statusText || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <main className="pt-16 p-4 container mx-auto">
      <h1>{message}</h1>
      <p>{details}</p>
      {stack && (
        <pre className="w-full p-4 overflow-x-auto">
          <code>{stack}</code>
        </pre>
      )}
    </main>
  );
}
