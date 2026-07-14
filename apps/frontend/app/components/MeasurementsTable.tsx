import { useMemo, useState } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
} from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table"; // Adjust path to your UI components

interface Props {
  table: number[][];
  sensorSize: number;
  error: string;
}

const MeasurementsTable = ({ table, sensorSize, error }: Props) => {
  const [absoluteData, setAbsoluteData] = useState(false);
  const initialData = table[0];
  const data = useMemo(() => {
    return table.map((row) => {
      const rowData: Record<string, number> = { time: row[0] };
      for (let i = 1; i <= sensorSize; i++) {
        rowData[`sensor_${i}`] = absoluteData
          ? row[i]
          : initialData[i] - row[i];
      }
      return rowData;
    });
  }, [table, sensorSize, absoluteData]);
  const columns = useMemo<ColumnDef<Record<string, number>>[]>(() => {
    const cols: ColumnDef<Record<string, number>>[] = [
      {
        accessorKey: "time",
        header: "Время",
      },
    ];

    for (let i = 1; i <= sensorSize; i++) {
      cols.push({
        accessorKey: `sensor_${i}`,
        header: `Сенсор ${i}`,
      });
    }

    return cols;
  }, [sensorSize]);

  const tableInstance = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: {
        pageSize: 10,
        pageIndex: 0,
      },
    },
  });

  return (
    <div className="min-w-0 md:mx-8 my-4 rounded-[10px] shadow-md shadow-primary-300 border border-primary-300 overflow-hidden">
      <div className="overflow-x-auto overscroll-x-none">
        <Table className="w-full table-auto border-collapse">
          <TableHeader>
            {tableInstance.getHeaderGroups().map((headerGroup) => (
              <TableRow
                key={headerGroup.id}
                className="bg-primary-300 font-semibold text-lg lg:text-xl text-primary-600"
              >
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className={`text-primary-900 h-8 font-semibold py-2 px-4 ${
                      header.id === "time"
                        ? "border-r border-primary-400 text-left"
                        : "text-right"
                    }`}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>

          <TableBody>
            {tableInstance.getRowModel().rows?.length ? (
              tableInstance.getRowModel().rows.map((row, rowIndex) => (
                <TableRow
                  key={row.id}
                  className={`${
                    rowIndex % 2 === 0 ? "bg-grey-50" : "bg-grey-100"
                  } border-primary-200 h-7`}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className={`px-6 ${
                        cell.column.id === "time"
                          ? "border-r border-primary-300  text-left text-base font-semibold"
                          : "text-right font-medium"
                      }`}
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-10 text-primary-900 text-2xl font-semibold text-center"
                >
                  {error.length !== 0 ? `${error}` : "Нет записей."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {tableInstance.getRowModel().rows?.length > 0 && (
        <div className="flex items-center justify-between px-4 py-3 bg-grey-50 border-t border-primary-200">
          <div className="flex gap-4 items-center">
            <div className="text-sm text-primary-700">
              Страница{" "}
              <span className="font-medium">
                {tableInstance.getState().pagination.pageIndex + 1}
              </span>{" "}
              из{" "}
              <span className="font-medium">
                {tableInstance.getPageCount()}
              </span>
            </div>
            <div className="text-primary-600 font-semibold text-lg flex gap-2">
              <input
                type="checkbox"
                onClick={() =>
                  setAbsoluteData((prev) => {
                    return !prev;
                  })
                }
              />
              Абсолютные значения
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => tableInstance.previousPage()}
              disabled={!tableInstance.getCanPreviousPage()}
              className="px-4 py-1.5 text-sm font-medium rounded-md bg-primary-300 text-primary-900 hover:bg-primary-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Назад
            </button>
            <button
              onClick={() => tableInstance.nextPage()}
              disabled={!tableInstance.getCanNextPage()}
              className="px-4 py-1.5 text-sm font-medium rounded-md bg-primary-300 text-primary-900 hover:bg-primary-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Вперед
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MeasurementsTable;
