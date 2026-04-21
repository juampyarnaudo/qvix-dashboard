"use client";
import { Fragment } from "react";
import type { OrgStats } from "../lib/types";

interface Props {
  orgStats: OrgStats[];
}

const DiffCell = ({ v }: { v?: number }) => {
  if (v === undefined) return <td className="px-3 py-2 text-slate-500 text-center">-</td>;
  const color = v > 0 ? "text-emerald-400" : v < 0 ? "text-red-400" : "text-slate-400";
  const sign = v > 0 ? "+" : "";
  return (
    <td className={`px-3 py-2 text-center font-mono text-sm ${color}`}>
      {sign}{v}%
    </td>
  );
};

export default function DiffTable({ orgStats }: Props) {
  const fechas = [
    ...new Set(orgStats.flatMap((o) => o.datos.map((d) => d.fecha))),
  ].sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 overflow-x-auto">
      <h3 className="text-slate-200 font-semibold mb-4">Variación % por período</h3>
      <table className="w-full text-sm text-slate-300">
        <thead>
          <tr className="border-b border-slate-700">
            <th className="px-3 py-2 text-left text-slate-400">Organización</th>
            {fechas.slice(1).map((f) => (
              <th key={f} colSpan={2} className="px-3 py-2 text-center text-slate-400 text-xs">
                {f.slice(5).replace("-", "/")}
              </th>
            ))}
          </tr>
          <tr className="border-b border-slate-700">
            <th />
            {fechas.slice(1).map((f) => (
              <Fragment key={f}>
                <th className="px-3 py-1 text-center text-slate-500 text-xs">STB</th>
                <th className="px-3 py-1 text-center text-slate-500 text-xs">Móvil</th>
              </Fragment>
            ))}
          </tr>
        </thead>
        <tbody>
          {orgStats.map((org) => (
            <tr key={org.organizacion} className="border-b border-slate-700/50 hover:bg-slate-700/30">
              <td className="px-3 py-2 font-medium text-slate-200">{org.organizacion}</td>
              {org.datos.slice(1).map((d, i) => (
                <Fragment key={i}>
                  <DiffCell v={d.stbDiff} />
                  <DiffCell v={d.movilDiff} />
                </Fragment>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
