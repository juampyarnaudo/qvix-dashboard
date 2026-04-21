"use client";
import type { OrgStats } from "../lib/types";
import { projectNext } from "../lib/dataUtils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface Props {
  orgStats: OrgStats[];
}

export default function ProjectionTable({ orgStats }: Props) {
  const rows = orgStats.map((org) => {
    const stbValues = org.datos.map((d) => d.stb);
    const movilValues = org.datos.map((d) => d.movil);
    const stbProj = projectNext(stbValues);
    const movilProj = projectNext(movilValues);
    const lastStb = stbValues.at(-1) ?? 0;
    const lastMovil = movilValues.at(-1) ?? 0;
    const stbDiff = stbProj !== null ? stbProj - lastStb : null;
    const movilDiff = movilProj !== null ? movilProj - lastMovil : null;
    return { org: org.organizacion, stbProj, movilProj, stbDiff, movilDiff, lastStb, lastMovil };
  });

  // Totales proyectados
  const totalStbProj = rows.reduce((s, r) => s + (r.stbProj ?? 0), 0);
  const totalMovilProj = rows.reduce((s, r) => s + (r.movilProj ?? 0), 0);
  const totalLastStb = rows.reduce((s, r) => s + r.lastStb, 0);
  const totalLastMovil = rows.reduce((s, r) => s + r.lastMovil, 0);

  const DiffBadge = ({ diff }: { diff: number | null }) => {
    if (diff === null) return <span className="text-slate-600">-</span>;
    const color = diff > 0 ? "text-emerald-400" : diff < 0 ? "text-red-400" : "text-slate-500";
    const Icon = diff > 0 ? TrendingUp : diff < 0 ? TrendingDown : Minus;
    return (
      <span className={`flex items-center gap-1 justify-center ${color} text-xs`}>
        <Icon size={12} />
        {diff > 0 ? "+" : ""}{diff.toLocaleString()}
      </span>
    );
  };

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 overflow-x-auto">
      <div className="mb-4">
        <h3 className="text-slate-200 font-semibold">Proyección próximo período</h3>
        <p className="text-xs text-slate-500 mt-1">Estimación por regresión lineal sobre datos históricos</p>
      </div>
      <table className="w-full text-sm text-slate-300">
        <thead>
          <tr className="border-b border-slate-700">
            <th className="px-3 py-2 text-left text-slate-400">Organización</th>
            <th className="px-3 py-2 text-center text-slate-400" colSpan={2}>STB</th>
            <th className="px-3 py-2 text-center text-slate-400" colSpan={2}>Móvil</th>
          </tr>
          <tr className="border-b border-slate-700">
            <th />
            <th className="px-3 py-1 text-center text-slate-500 text-xs">Actual</th>
            <th className="px-3 py-1 text-center text-slate-500 text-xs">Proyectado</th>
            <th className="px-3 py-1 text-center text-slate-500 text-xs">Actual</th>
            <th className="px-3 py-1 text-center text-slate-500 text-xs">Proyectado</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.org} className="border-b border-slate-700/50 hover:bg-slate-700/30">
              <td className="px-3 py-2 font-medium text-slate-200">{r.org}</td>
              <td className="px-3 py-2 text-center font-mono">{r.lastStb.toLocaleString()}</td>
              <td className="px-3 py-2 text-center">
                <div className="font-mono text-indigo-300">{r.stbProj?.toLocaleString() ?? "-"}</div>
                <DiffBadge diff={r.stbDiff} />
              </td>
              <td className="px-3 py-2 text-center font-mono">{r.lastMovil.toLocaleString()}</td>
              <td className="px-3 py-2 text-center">
                <div className="font-mono text-emerald-300">{r.movilProj?.toLocaleString() ?? "-"}</div>
                <DiffBadge diff={r.movilDiff} />
              </td>
            </tr>
          ))}
          <tr className="border-t-2 border-slate-600 bg-slate-700/30 font-semibold text-slate-100">
            <td className="px-3 py-2">TOTAL</td>
            <td className="px-3 py-2 text-center font-mono">{totalLastStb.toLocaleString()}</td>
            <td className="px-3 py-2 text-center">
              <div className="font-mono text-indigo-300">{totalStbProj.toLocaleString()}</div>
              <DiffBadge diff={totalStbProj - totalLastStb} />
            </td>
            <td className="px-3 py-2 text-center font-mono">{totalLastMovil.toLocaleString()}</td>
            <td className="px-3 py-2 text-center">
              <div className="font-mono text-emerald-300">{totalMovilProj.toLocaleString()}</div>
              <DiffBadge diff={totalMovilProj - totalLastMovil} />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
