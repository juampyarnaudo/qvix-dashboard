"use client";
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";
import type { DataRow } from "../lib/types";
import { getColor } from "../lib/dataUtils";
import { useTheme } from "../lib/useTheme";

interface Props {
  rows: DataRow[];
  tipo: "stb" | "movil";
  title: string;
}

const renderLabel = ({ name, percent }: { name?: string; percent?: number }) =>
  `${name ?? ""} ${((percent ?? 0) * 100).toFixed(1)}%`;

export default function DonutChart({ rows, tipo, title }: Props) {
  const { chart } = useTheme();
  const fechas = [...new Set(rows.map((r) => r.fecha))].sort();
  const lastFecha = fechas.at(-1);
  if (!lastFecha) return null;

  const lastRows = rows.filter((r) => r.fecha === lastFecha);
  const data = lastRows
    .map((r) => ({ name: r.organizacion, value: r[tipo] }))
    .filter((d) => d.value > 0);

  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
      <h3 className="text-slate-200 font-semibold mb-1">{title}</h3>
      <p className="text-xs text-slate-500 mb-4">
        Último período: {lastFecha} — Total: {total.toLocaleString()}
      </p>
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={70}
            outerRadius={110}
            paddingAngle={2}
            dataKey="value"
            label={renderLabel}
            labelLine={false}
          >
            {data.map((entry, i) => (
              <Cell key={i} fill={getColor(entry.name, i)} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{ backgroundColor: chart.tooltipBg, border: `1px solid ${chart.tooltipBorder}`, borderRadius: 8 }}
            labelStyle={{ color: chart.tooltipLabel }}
            formatter={(value, name) => {
              const num = Number(value);
              return [`${num.toLocaleString()} (${((num / total) * 100).toFixed(1)}%)`, String(name)];
            }}
          />
          <Legend
            formatter={(value) => (
              <span style={{ color: chart.legend, fontSize: 12 }}>{value}</span>
            )}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
