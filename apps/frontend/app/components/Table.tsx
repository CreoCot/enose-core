import axios from "axios";
import { useEffect, useState } from "react";

interface Props {
  table: number[][];
  sensorSize: number;
  error: string;
}

const Table = ({ error }: Props) => {
  const table = [
    [1.0, 3035335, 1079283, 3063403, 4572385, 4718126, 2171860],
    [1.001, 8049857, 8343584, 1896698, 4704505, 7175946, 5801551],
    [1.002, 3210484, 5234373, 7780900, 5240003, 8321377, 2187739],
    [1.003, 2012140, 1837319, 4819784, 1654538, 8313558, 8870208],
    [1.004, 9526905, 7170916, 8791100, 6070606, 2387246, 4504152],
    [1.005, 1425389, 7960530, 3119926, 9386248, 5862838, 5751098],
    [1.006, 2788219, 2836282, 9630649, 3024856, 5540688, 2670517],
    [1.007, 2174182, 8981472, 4406392, 9930072, 3721285, 7627198],
    [1.008, 2936165, 6435427, 5280492, 6534750, 4000698, 5858299],
    [1.009, 5453762, 2945057, 4055304, 8547133, 5497026, 1229876],
  ];
  let sensorSize = table[0].length - 1;
  const tableW = "w-10";
  const headRowClass = "bg-primary-300 h-7 text-primary-800 text-xl";
  const rowClass = "bg-primary-100 h-7 text-primary-700 font-light text-sm";
  return (
    <>
      {sensorSize === 0 && (
        <div className="text-primary-700 font-bold text-3xl mx-8 my-4mx-8 my-4">
          {error.length === 0 ? "Получаем таблицу..." : error}
        </div>
      )}
      {sensorSize !== 0 && (
        <div className="mx-8 my-4 inline-block overflow-hidden rounded-[10px] shadow-md shadow-primary-300 border border-primary-300">
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
