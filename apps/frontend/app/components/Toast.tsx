import { motion } from "motion/react";

interface Props {
  children: string;
  onClose: () => void;
}

const Toast = ({ children, onClose }: Props) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.15, ease: "easeIn" }}
      className="flex gap-3 justify-between absolute top-0 right-1/2 translate-x-1/2 px-5 my-9 z-10 py-3 bg-red-100 text-red-600 text-lg outline outline-red-300 rounded-[10px]"
    >
      <p>{children}</p>
      <button
        onClick={onClose}
        className="text-grey-500 font-semibold cursor-pointer hover:text-grey-600 transition-colors duration-150"
      >
        <span>X</span>
      </button>
    </motion.div>
  );
};

export default Toast;
