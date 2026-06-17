import axios from "axios";
import { useEffect, useState } from "react";

interface Props {
  table: number[][];
  sensorSize: number;
  error: string;
}

const Table = ({ table, sensorSize, error }: Props) => {
  const tableW = "w-10";
  const headRowClass = "bg-primary-300 h-7 text-primary-700 text-xl";
  const rowClass = "bg-primary-100 h-7 text-primary-700 font-light text-sm";
  return (
    <>
      {sensorSize === 0 && (
        <div className="text-primary-700 font-bold text-3xl mx-8 my-4mx-8 my-4">
          {error.length === 0 ? "Получаем таблицу..." : error}
        </div>
      )}
      {sensorSize !== 0 && (
        <div className="mx-8 my-4 inline-block overflow-hidden rounded-[10px] shadow-md shadow-primary-300 border border-primary-300 overflow-x-auto overscroll-x-none">
          <table className="w-full border-collapse">
            <thead>
              <tr className={headRowClass}>
                <th
                  className={`border-r ${tableW} border-primary-400 px-4 text-left`}
                >
                  Время
                </th>
                {Array.from({ length: sensorSize }, (_, i) => (
                  <th className={`${tableW} px-4`} key={i}>
                    Сенсор {i + 1}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.map((el, rowIndex) => {
                return (
                  <tr
                    key={rowIndex}
                    className={`${rowClass} border-primary-200`}
                  >
                    {el.map((e, index) => {
                      return (
                        <td
                          key={index}
                          className={`px-6 ${
                            index === 0
                              ? "border-r border-primary-300 text-left font-normal"
                              : "text-right"
                          }`}
                        >
                          {e}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
};

export default Table;
