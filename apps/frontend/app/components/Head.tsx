interface Props {
  children: string;
}
const Head = ({ children }: Props) => {
  return (
    <div className="flex w-full h-8 bg-grey-100 border-b border-b-grey-300 items-center font-medium">
      <h1 className="pl-7 text-2xl text-primary-700">{children}</h1>
    </div>
  );
};

export default Head;
