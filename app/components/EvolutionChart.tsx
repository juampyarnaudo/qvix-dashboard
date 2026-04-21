"use client";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { getColor } from "../lib/dataUtils";
import type { DataRow } from "../lib/types";
import CustomTooltip from "./CustomTooltip";
import { useTheme } from "../lib/useTheme";

interface Props {
  rows: DataRow[];
  tipo: "stb" | "movil";
  title: string;
}

export default function EvolutionChart({ rows, tipo, title }: Props) {
  const { chart } = useTheme();
  const fechas = [...new Set(rows.map((r) => r.fecha))].sort(
    (a, b) => new Date(a).getTime() - new Date(b).getTime()
  );
  const orgs = [...new Set(rows.map((r) => r.organizacion))];

  const data = fechas.map((fecha, fi) => {
    const entry: Record<string, string | number> = {
      fecha: fecha.slice(5).replace("-", "/"),
    };
    for (const org of orgs) {
      const row = rows.find((r) => r.organizacion === org && r.fecha === fecha);
      entry[org] = row ? (tipo === "stb" ? row.stb : row.movil) : 0;
    }
    return entry;
  });

  // Para el tooltip: construir prevData por índice
  const getPrevData = (index: number): Record<string, number> | undefined => {
    if (index <= 0) return undefined;
    const prev = data[index - 1];
    return Object.fromEntries(orgs.map((o) => [o, prev[o] as number]));
  };

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
      <h3 className="text-slate-200 font-semibold mb-4">{title}</h3>
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} />
          <XAxis dataKey="fecha" tick={{ fill: chart.axis, fontSize: 12 }} />
          <YAxis tick={{ fill: chart.axis, fontSize: 12 }} />
          <Tooltip
            content={(props) => {
              const idx = data.findIndex((d) => d.fecha === props.label);
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              return <CustomTooltip {...(props as any)} prevData={getPrevData(idx)} />;
            }}
          />
          <Legend wrapperStyle={{ color: chart.legend, fontSize: 12 }} />
          {orgs.map((org, i) => (
            <Line
              key={org}
              type="monotone"
              dataKey={org}
              stroke={getColor(org, i)}
              strokeWidth={2}
              dot={{ r: 4 }}
              activeDot={{ r: 6 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
