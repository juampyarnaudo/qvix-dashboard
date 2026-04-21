"use client";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, BarChart, Bar, Legend,
} from "recharts";
import { TrendingUp, TrendingDown, Minus, Monitor, Smartphone, Activity } from "lucide-react";
import type { OrgStats } from "../lib/types";
import { getColor } from "../lib/dataUtils";
import { useTheme } from "../lib/useTheme";

interface Props {
  org: OrgStats;
  index: number;
}

const diffColor = (v?: number) => {
  if (v === undefined) return "text-slate-500";
  if (v > 0) return "text-emerald-400";
  if (v < 0) return "text-red-400";
  return "text-slate-400";
};

const DiffBadge = ({ v }: { v?: number }) => {
  if (v === undefined) return <span className="text-slate-600 text-xs">—</span>;
  const color = v > 0 ? "bg-emerald-100 text-emerald-700 border-emerald-300 dark-diff-pos"
    : v < 0 ? "bg-red-100 text-red-600 border-red-300 dark-diff-neg"
    : "bg-slate-100 text-slate-500 border-slate-300 dark-diff-neutral";
  const icon = v > 0 ? <TrendingUp size={11} /> : v < 0 ? <TrendingDown size={11} /> : <Minus size={11} />;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-mono ${color}`}>
      {icon}{v > 0 ? "+" : ""}{v}%
    </span>
  );
};

export default function OrgDetail({ org, index }: Props) {
  const { chart } = useTheme();
  const color = getColor(org.organizacion, index);
  const last = org.datos[org.datos.length - 1];
  const first = org.datos[0];

  const chartData = org.datos.map((d) => ({
    fecha: d.fecha.slice(5).replace("-", "/"),
    STB: d.stb,
    Móvil: d.movil,
    Total: d.stb + d.movil,
  }));

  const totalCrecSTB = first ? last.stb - first.stb : 0;
  const totalCrecMovil = first ? last.movil - first.movil : 0;
  const pctSTB = first && first.stb ? ((totalCrecSTB / first.stb) * 100).toFixed(1) : null;
  const pctMovil = first && first.movil ? ((totalCrecMovil / first.movil) * 100).toFixed(1) : null;

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-2xl overflow-hidden">
      {/* Org header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-700" style={{ borderLeftColor: color, borderLeftWidth: 4 }}>
        <Activity size={18} style={{ color }} />
        <h3 className="text-slate-100 font-semibold text-base">{org.organizacion}</h3>
        <span className="text-slate-500 text-xs ml-auto">{org.datos.length} período{org.datos.length !== 1 ? "s" : ""}</span>
      </div>

      <div className="p-6 space-y-6">
        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "STB actual", value: last.stb, icon: <Monitor size={14} />, sub: `desde inicio: ${totalCrecSTB >= 0 ? "+" : ""}${totalCrecSTB}`, pct: pctSTB },
            { label: "Móvil actual", value: last.movil, icon: <Smartphone size={14} />, sub: `desde inicio: ${totalCrecMovil >= 0 ? "+" : ""}${totalCrecMovil}`, pct: pctMovil },
            { label: "Total actual", value: last.stb + last.movil, icon: null, sub: "STB + Móvil", pct: null },
            { label: "Var% STB último", value: null, icon: null, sub: "respecto al período anterior", pct: null, badge: last.stbDiff },
          ].map((k, i) => (
            <div key={i} className="bg-slate-900/60 border border-slate-700 rounded-xl p-4">
              <div className="flex items-center gap-1.5 text-slate-400 text-xs mb-2">
                {k.icon}{k.label}
              </div>
              {k.value !== null ? (
                <div className="text-2xl font-bold text-slate-100">{k.value.toLocaleString()}</div>
              ) : (
                <div className="mt-1"><DiffBadge v={k.badge} /></div>
              )}
              <div className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                {k.sub}
                {k.pct !== null && k.pct !== undefined && (
                  <span className={`font-mono ${diffColor(parseFloat(k.pct))}`}>({parseFloat(k.pct) >= 0 ? "+" : ""}{k.pct}%)</span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Gráfico de evolución */}
        <div>
          <p className="text-slate-400 text-xs uppercase tracking-wider mb-3">Evolución</p>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} />
              <XAxis dataKey="fecha" tick={{ fill: chart.axis, fontSize: 11 }} />
              <YAxis tick={{ fill: chart.axis, fontSize: 11 }} />
              <Tooltip
                contentStyle={{ backgroundColor: chart.tooltipBg, border: `1px solid ${chart.tooltipBorder}`, borderRadius: 8 }}
                labelStyle={{ color: chart.tooltipLabel }}
                itemStyle={{ color: chart.tooltipItem }}
              />
              <Legend wrapperStyle={{ color: chart.legend, fontSize: 11 }} />
              <Line type="monotone" dataKey="STB" stroke="#6366f1" strokeWidth={2} dot={{ r: 4 }} />
              <Line type="monotone" dataKey="Móvil" stroke="#22c55e" strokeWidth={2} dot={{ r: 4 }} />
              <Line type="monotone" dataKey="Total" stroke="#f59e0b" strokeWidth={2} strokeDasharray="4 2" dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Tabla de períodos */}
        <div>
          <p className="text-slate-400 text-xs uppercase tracking-wider mb-3">Detalle por período</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-slate-300">
              <thead>
                <tr className="border-b border-slate-700 text-xs text-slate-500">
                  <th className="py-2 px-3 text-left">Fecha</th>
                  <th className="py-2 px-3 text-center">STB</th>
                  <th className="py-2 px-3 text-center">Var% STB</th>
                  <th className="py-2 px-3 text-center">Móvil</th>
                  <th className="py-2 px-3 text-center">Var% Móvil</th>
                  <th className="py-2 px-3 text-center">Total</th>
                </tr>
              </thead>
              <tbody>
                {org.datos.map((d, i) => (
                  <tr key={i} className="border-b border-slate-700/50 hover:bg-slate-700/20">
                    <td className="py-2 px-3 font-mono text-slate-300">{d.fecha}</td>
                    <td className="py-2 px-3 text-center font-mono">{d.stb}</td>
                    <td className="py-2 px-3 text-center"><DiffBadge v={d.stbDiff} /></td>
                    <td className="py-2 px-3 text-center font-mono">{d.movil}</td>
                    <td className="py-2 px-3 text-center"><DiffBadge v={d.movilDiff} /></td>
                    <td className="py-2 px-3 text-center font-mono text-slate-200 font-medium">{d.stb + d.movil}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
