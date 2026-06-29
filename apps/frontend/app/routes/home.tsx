import { motion, type Variants } from "motion/react";
import type { Route } from "./+types/home";
import { NavLink } from "react-router";
import { useState } from "react";
export function meta({}: Route.MetaArgs) {
  return [
    { title: "New React Router App" },
    { name: "description", content: "Welcome to React Router!" },
  ];
}

export default function Home() {
  const containerVariants = {
    initial: { opacity: 0 },
    animate: {
      opacity: 1,
      transition: {
        staggerChildren: 1,
      },
    },
  };
  const childVariants: Variants = {
    initial: { opacity: 0, y: -30 },
    animate: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.7,
        ease: "easeOut",
      },
    },
  };
  const dotContainerVariants = {
    initial: { opacity: 1 },
    animate: {
      transition: {
        staggerChildren: 0.2,
      },
    },
  };

  const dotVariants: Variants = {
    initial: { opacity: 0 },
    animate: {
      opacity: 1,
      transition: {
        duration: 0.7,
        repeat: Infinity,
        repeatType: "reverse",
        ease: "easeInOut",
      },
    },
  };
  const [clicked, setClicked] = useState(false);
  return (
    <div className="relative w-full h-screen bg-[radial-gradient(circle_at_center,#070750_0%,#3A147B_35%,#191D34_92%)] flex justify-center">
      <div className="absolute inset-0 bg-[#191D34]/20 pointer-events-none" />
      <motion.div
        variants={containerVariants}
        initial="initial"
        animate="animate"
        className="flex flex-col max-w-screen gap-9 md:gap-8 items-center w-13 h-13 sm:w-14 sm:h-13 md:w-15 md:h-13 lg:w-16 pt-8 md:pt-8 absolute inset-x-1/2 inset-y-13 -translate-1/2 rounded-[15px] backdrop-blur-xl border-l border-l-primary-200/40 border-r border-r-accent-200/40"
      >
        <div className="absolute inset-0 flex after:absolute after:inset-0 after:rounded-[15px] after:bg-linear-90 after:to-3% after:from-primary-300/7 before:absolute before:inset-0 before:rounded-[15px] before:bg-linear-270 before:to-3% before:from-accent-300/7" />
        <div className="flex flex-col items-center">
          <motion.h1
            variants={childVariants}
            className="font-mono text-primary-100 text-shadow-lg text-shadow-primary-900 text-3xl sm:text-4xl md:text-5xl font-bold"
          >
            Электронный нос -
          </motion.h1>
          <motion.h2
            variants={childVariants}
            className="font-mono pt-2 text-primary-300 text-shadow-lg text-shadow-primary-900 text-2xl sm:text-3xl md:text-4xl font-semibold"
          >
            Всегда с вами
          </motion.h2>
        </div>
        <motion.button
          onClick={() => setClicked(true)}
          whileHover={{ y: -3 }}
          whileTap={{ y: 2 }}
          transition={{ type: "spring", stiffness: 300, damping: 10 }}
          variants={childVariants}
          className="relative flex items-center justify-center w-11 h-7 sm:w-12 sm:h-8 rounded-[10px] shadow-md border border-primary-100/40 border-b-primary-900/40 border-r-primary-900/20 backdrop-blur-lg text-primary-200 text-xl sm:text-2xl font-semibold bg-linear-359 from-93% to-primary-100 after:absolute after:inset-0 after:rounded-[10px] after:bg-linear-179 after:from-93% after:to-primary-900/40"
        >
          <NavLink
            to="/login"
            className="z-10 cursor-pointer absolute inset-0"
          />
          Вход
          {clicked && (
            <motion.div variants={dotContainerVariants}>
              <motion.span variants={dotVariants}>.</motion.span>
              <motion.span variants={dotVariants}>.</motion.span>
              <motion.span variants={dotVariants}>.</motion.span>
            </motion.div>
          )}
        </motion.button>
      </motion.div>
    </div>
  );
}
