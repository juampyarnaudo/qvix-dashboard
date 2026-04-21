"use client";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { OrgStats } from "../lib/types";

interface Props {
  orgStats: OrgStats[];
}

export default function RankingTable({ orgStats }: Props) {
  const rows = orgStats
    .map((o) => {
      const last = o.datos.at(-1)!;
      const stbDiff = last.stbDiff ?? 0;
      const movilDiff = last.movilDiff ?? 0;
      const avgDiff = parseFloat(((stbDiff + movilDiff) / 2).toFixed(2));
      return { org: o.organizacion, stbDiff, movilDiff, avgDiff, stb: last.stb, movil: last.movil };
    })
    .sort((a, b) => b.avgDiff - a.avgDiff);

  const Badge = ({ v }: { v: number }) => {
    const color = v > 0 ? "text-emerald-400" : v < 0 ? "text-red-400" : "text-slate-500";
    const Icon = v > 0 ? TrendingUp : v < 0 ? TrendingDown : Minus;
    return (
      <span className={`flex items-center gap-1 font-mono text-sm ${color}`}>
        <Icon size={13} />
        {v > 0 ? "+" : ""}{v}%
      </span>
    );
  };

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 overflow-x-auto">
      <h3 className="text-slate-200 font-semibold mb-1">Ranking por crecimiento</h3>
      <p className="text-xs text-slate-500 mb-4">Ordenado por variación promedio (STB + Móvil) del último período</p>
      <table className="w-full text-sm text-slate-300">
        <thead>
          <tr className="border-b border-slate-700">
            <th className="px-3 py-2 text-left text-slate-400 w-8">#</th>
            <th className="px-3 py-2 text-left text-slate-400">Organización</th>
            <th className="px-3 py-2 text-center text-slate-400">Var% STB</th>
            <th className="px-3 py-2 text-center text-slate-400">Var% Móvil</th>
            <th className="px-3 py-2 text-center text-slate-400">Promedio</th>
            <th className="px-3 py-2 text-center text-slate-400">STB actual</th>
            <th className="px-3 py-2 text-center text-slate-400">Móvil actual</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.org} className="border-b border-slate-700/50 hover:bg-slate-700/30">
              <td className="px-3 py-2 text-slate-500 font-mono text-xs">{i + 1}</td>
              <td className="px-3 py-2 font-medium text-slate-200">{r.org}</td>
              <td className="px-3 py-2 text-center"><Badge v={r.stbDiff} /></td>
              <td className="px-3 py-2 text-center"><Badge v={r.movilDiff} /></td>
              <td className="px-3 py-2 text-center font-semibold"><Badge v={r.avgDiff} /></td>
              <td className="px-3 py-2 text-center font-mono">{r.stb.toLocaleString()}</td>
              <td className="px-3 py-2 text-center font-mono">{r.movil.toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
