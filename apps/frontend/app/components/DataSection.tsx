import { useState, type ReactNode } from "react";

interface Props {
  children?: ReactNode;
  name: string;
}

const DataSection = ({ children, name }: Props) => {
  const color = "#070750"; // primary-900
  const openIcon = (
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
        d="m19.5 8.25-7.5 7.5-7.5-7.5"
      />
    </svg>
  );
  const closedIcon = (
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
  const [open, setOpen] = useState<boolean>(false);
  return (
    <div className="flex flex-col">
      <button
        onClick={() => {
          setOpen(!open);
        }}
        className={`flex gap-1 text-3xl text-primary-900 font-bold pt-5 pl-6 cursor-pointer ${open ? "pb-3" : "pb-2"} items-stretch`}
      >
        {open ? openIcon : closedIcon}
        {name}
      </button>
      {open && children}
    </div>
  );
};

export default DataSection;
