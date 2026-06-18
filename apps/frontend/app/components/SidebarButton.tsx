import { NavLink, useMatch, useResolvedPath } from "react-router";

interface Props {
  children?: string;
  to: string;
  type: "home" | "data";
}

const SidebarButton = ({ children, type, to }: Props) => {
  const iconSize = 24;
  const selectedIconSize = 22;

  const resolvedPath = useResolvedPath(to);
  const isActive = !!useMatch({ path: resolvedPath.pathname, end: true });

  var size;
  if (isActive) size = selectedIconSize;
  else size = iconSize;
  const homeIcon = (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox={`0 0 ${size} ${size}`}
      strokeWidth={1.5}
      stroke="currentColor"
      className="size-5 lg:size-6"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25"
      />
    </svg>
  );
  const selectedHomeIcon = (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${size} ${size}`}
      fill="currentColor"
      className="size-5 lg:size-6"
    >
      <path d="M11.47 3.841a.75.75 0 0 1 1.06 0l8.69 8.69a.75.75 0 1 0 1.06-1.061l-8.689-8.69a2.25 2.25 0 0 0-3.182 0l-8.69 8.69a.75.75 0 1 0 1.061 1.06l8.69-8.689Z" />
      <path d="m12 5.432 8.159 8.159c.03.03.06.058.091.086v6.198c0 1.035-.84 1.875-1.875 1.875H15a.75.75 0 0 1-.75-.75v-4.5a.75.75 0 0 0-.75-.75h-3a.75.75 0 0 0-.75.75V21a.75.75 0 0 1-.75.75H5.625a1.875 1.875 0 0 1-1.875-1.875v-6.198a2.29 2.29 0 0 0 .091-.086L12 5.432Z" />
    </svg>
  );
  const dataIcon = (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox={`0 0 ${size} ${size}`}
      strokeWidth={1.5}
      stroke="currentColor"
      className="size-5 lg:size-6"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z"
      />
    </svg>
  );
  const selectedDataIcon = (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${size} ${size}`}
      fill="currentColor"
      className="size-5 lg:size-6"
    >
      <path d="M18.375 2.25c-1.035 0-1.875.84-1.875 1.875v15.75c0 1.035.84 1.875 1.875 1.875h.75c1.035 0 1.875-.84 1.875-1.875V4.125c0-1.036-.84-1.875-1.875-1.875h-.75ZM9.75 8.625c0-1.036.84-1.875 1.875-1.875h.75c1.036 0 1.875.84 1.875 1.875v11.25c0 1.035-.84 1.875-1.875 1.875h-.75a1.875 1.875 0 0 1-1.875-1.875V8.625ZM3 13.125c0-1.036.84-1.875 1.875-1.875h.75c1.036 0 1.875.84 1.875 1.875v6.75c0 1.035-.84 1.875-1.875 1.875h-.75A1.875 1.875 0 0 1 3 19.875v-6.75Z" />
    </svg>
  );

  function getIcon(type: Props["type"], selected: boolean) {
    if (type === "home" && !selected) {
      return homeIcon;
    } else if (type === "home" && selected) {
      return selectedHomeIcon;
    } else if (type === "data" && !selected) {
      return dataIcon;
    } else if (type === "data" && selected) {
      return selectedDataIcon;
    }
  }
  return (
    <NavLink
      to={to}
      className={`flex ${
        isActive ? "gap-3" : "gap-2"
      } pt-3 pb-2 transition-colors duration-200 p-4 text-xl lg:text-2xl ${
        isActive
          ? "text-accent-700 hover:text-accent-800 font-extrabold items-baseline"
          : "text-primary-500 hover:text-primary-400 font-medium"
      }`}
    >
      {getIcon(type, isActive)}
      {children}
    </NavLink>
  );
};

export default SidebarButton;
