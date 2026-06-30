import { useMemo } from "react";
import { Link } from "react-router";
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
import type { Entry } from "../routes/data";
import { setEntryCacheNull } from "../routes/data";

const columns: ColumnDef<Entry>[] = [
  {
    accessorKey: "name",
    header: "Имя записи",
    cell: ({ row }) => (
      <Link to={`/entry/${row.id}`} className="hover:underline cursor-pointer">
        {row.getValue("name")}
      </Link>
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
      <button
        className="rounded-full w-11 p-0.5 text-red-900 bg-red-200 border lg:mr-7 border-red-400 text-center disabled:cursor-not-allowed cursor-pointer disabled:bg-red-100 disabled:border-red-200 enabled:hover:bg-red-300 transition-colors"
        onClick={() => {
          setEntryCacheNull();
        }}
        disabled
      >
        Удалить &lt;not done&gt;
      </button>
    ),
  },
];

interface Props {
  entries: Entry[];
  error: string;
}

export default function FileTable({ entries, error }: Props) {
  const files = useMemo<Entry[]>(() => {
    return entries;
  }, []);

  // const files = useMemo<Entry[]>(
  //   () =>
  //     Array.from({ length: 23 }, (_, i) => ({
  //       id: i,
  //       name: `${i + 1}.txt`,
  //       date: `${(i % 28) + 1}.12.26`,
  //     })),
  //   [],
  // );

  // const files = useMemo(() => [], []);

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
              className="bg-grey-200 font-semibold text-xl lg:text-2xl"
            >
              {headerGroup.headers.map((header) => (
                <TableHead
                  key={header.id}
                  className={`text-grey-800 h-7 font-semibold py-2 ${
                    header.id === "name" ? "w-[40%] px-5" : ""
                  } ${header.id === "date" ? "w-full" : ""} ${
                    header.id === "actions"
                      ? "w-[30%] lg:px-7 text-center lg:text-left"
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
                className="bg-grey-50 hover:bg-grey-200/50 transition-colors"
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
                {error.length !== 0 ? `${error}` : "Нет записей."}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <div className="flex items-center justify-between px-4 md:py-1 lg:py-3 mt-px overflow-x-auto text-grey-800 overscroll-x-none">
        <div className="flex items-center gap-2">
          <span>Записей на странице:</span>
          <select
            value={table.getState().pagination.pageSize}
            onChange={(e) => table.setPageSize(Number(e.target.value))}
            className="border border-grey-400 text-grey-700 rounded px-2 py-1 cursor-pointer"
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
            className="w-10 h-6 rounded-[10px] disabled:bg-primary-100 disabled:cursor-not-allowed bg-primary-300 hover:bg-primary-200 text-primary-900 font-medium cursor-pointer transition-colors"
          >
            Назад
          </button>

          <button
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            className="w-10 h-6 rounded-[10px] disabled:bg-primary-100 disabled:cursor-not-allowed bg-primary-300 hover:bg-primary-200 text-accent-900 font-medium cursor-pointer transition-colors"
          >
            Вперед
          </button>
        </div>
      </div>
    </div>
  );
}
