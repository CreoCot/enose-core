import { useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";

interface Props {
  children?: ReactNode;
  initialOpen?: boolean;
  name: string;
}

const DataSection = ({ children, initialOpen = false, name }: Props) => {
  const color = "#070750"; // primary-900
  const icon = (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke={color}
      className="size-6"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m8.25 4.5 7.5 7.5-7.5 7.5"
      />
    </svg>
  );
  const [open, setOpen] = useState<boolean>(initialOpen);
  return (
    <div className="flex flex-col">
      <button
        onClick={() => {
          setOpen(!open);
        }}
        className={`flex gap-1 text-3xl text-primary-900 font-bold pt-5 pl-6 cursor-pointer ${
          open ? "pb-2" : "pb-1"
        } items-stretch`}
      >
        <motion.div
          className="flex items-center"
          animate={{ rotate: open ? 90 : 0 }}
          transition={{ duration: 0.15, ease: "easeInOut" }}
        >
          {icon}
        </motion.div>
        {name}
      </button>
      <AnimatePresence mode="wait">
        {open && (
          <motion.div
            className="flex flex-col"
            initial={{ opacity: open ? 0 : 1, y: -48 }}
            animate={{ opacity: open ? 1 : 0, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.2, ease: "easeIn" }}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default DataSection;
