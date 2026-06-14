import SidebarButton from "./SidebarButton";

const Sidebar = () => {
  return (
    <div className="flex flex-col bg-grey-200 border border-grey-300 min-h-screen w-12">
      <div className="flex h-8 w-full border-b border-b-grey-300 items-center justify-center">
        <SidebarButton to="/" type="home">
          Главная
        </SidebarButton>
      </div>

      <SidebarButton to="/data" type="data">
        Данные
      </SidebarButton>
    </div>
  );
};

export default Sidebar;
