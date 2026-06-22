import { useMemo } from "react";
import { NavLink } from "react-router";
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
} from "./ui/table";

type FileItem = {
  name: string;
  date: string;
};

export default function FileTable() {
  const files = useMemo<FileItem[]>(
    () =>
      Array.from({ length: 23 }, (_, i) => ({
        name: `${i + 1}.txt`,
        date: `${(i % 28) + 1}.12.26`,
      })),
    [],
  );
  // const files = useMemo(() => [], []);

  const columns = useMemo<ColumnDef<FileItem>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Имя записи",
        cell: ({ row }) => (
          <NavLink to={`/file`} className="hover:underline">
            {row.getValue("name")}
          </NavLink>
        ),
      },
      {
        accessorKey: "date",
        header: "Дата",
      },
      {
        id: "actions",
        header: "Действия",
        cell: ({ row }) => (
          <div
            className="rounded-full w-11 p-0.5 text-red-900 bg-red-200 border lg:mr-7 border-red-400 text-center cursor-pointer hover:bg-red-300 transition-colors" // here too damn
            onClick={() => {}}
          >
            Удалить
          </div>
        ),
      },
    ],
    [],
  );

  const table = useReactTable({
    data: files,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: {
        pageSize: 5,
      },
    },
  });

  return (
    <div className="overflow-hidden rounded-[8px] shadow-md mx-8 my-6 w-full">
      <Table className="w-full table-auto border-collapse">
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow
              key={headerGroup.id}
              className="bg-primary-300 font-semibold text-xl lg:text-2xl text-primary-600"
            >
              {headerGroup.headers.map((header) => (
                <TableHead
                  key={header.id}
                  className={`text-primary-900 h-7 font-semibold py-2 ${
                    header.id === "name" ? "w-[40%] px-5" : ""
                  } ${header.id === "date" ? "w-full" : ""} ${
                    header.id === "actions"
                      ? "w-[30%] lg:px-7 text-center lg:text-left" // here damn
                      : ""
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
          {table.getRowModel().rows?.length ? (
            table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                className="bg-primary-200 hover:bg-primary-200/50"
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell
                    key={cell.id}
                    className={`${
                      cell.column.id === "name"
                        ? "text-accent-800 text-lg lg:text-xl font-bold py-3 pl-5"
                        : "text-base text-primary-500 font-medium"
                    }`}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
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
                Нет записей.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <div className="flex items-center justify-between px-4 md:py-1 lg:py-3 mt-px bg-primary-300 overflow-x-auto overscroll-x-none">
        <div className="flex items-center gap-2">
          <span>Записей на странице:</span>
          <select
            value={table.getState().pagination.pageSize}
            onChange={(e) => table.setPageSize(Number(e.target.value))}
            className="border border-primary-400 text-primary-700 rounded px-2 py-1 cursor-pointer"
          >
            {[5, 10, 20, 30, 50].map((pageSize) => (
              <option key={pageSize} value={pageSize}>
                {pageSize}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-3">
          <span className="mx-4">
            Стр. {table.getState().pagination.pageIndex + 1} из{" "}
            {table.getPageCount()}
          </span>

          <button
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            className="w-10 h-6 border rounded-[10px] border-primary-400 disabled:bg-primary-100 disabled:cursor-auto bg-primary-300 hover:bg-primary-200 text-primary-900 cursor-pointer transition-colors"
          >
            Назад
          </button>

          <button
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            className="w-10 h-6 border rounded-[10px] border-accent-400 disabled:bg-accent-100 disabled:cursor-auto bg-accent-300 hover:bg-accent-200 text-accent-900 cursor-pointer transition-colors"
          >
            Вперед
          </button>
        </div>
      </div>
    </div>
  );
}
