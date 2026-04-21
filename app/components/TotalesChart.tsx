"use client";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import type { Totales } from "../lib/types";
import CustomTooltip from "./CustomTooltip";
import { useTheme } from "../lib/useTheme";

interface Props {
  totales: Totales[];
}

export default function TotalesChart({ totales }: Props) {
  const { chart } = useTheme();
  const data = totales.map((t) => ({
    fecha: t.fecha.slice(5).replace("-", "/"),
    STB: t.stb,
    Móvil: t.movil,
    Total: t.stb + t.movil,
  }));

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
      <h3 className="text-slate-200 font-semibold mb-4">Totales generales por período</h3>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} />
          <XAxis dataKey="fecha" tick={{ fill: chart.axis, fontSize: 12 }} />
          <YAxis tick={{ fill: chart.axis, fontSize: 12 }} />
          <Tooltip
            content={(props) => {
              const idx = data.findIndex((d) => d.fecha === props.label);
              const prevData = idx > 0
                ? { STB: data[idx - 1].STB as number, "Móvil": data[idx - 1].Móvil as number }
                : undefined;
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              return <CustomTooltip {...(props as any)} prevData={prevData} />;
            }}
          />
          <Legend wrapperStyle={{ color: chart.legend, fontSize: 12 }} />
          <Bar dataKey="STB" fill="#6366f1" radius={[4, 4, 0, 0]} />
          <Bar dataKey="Móvil" fill="#22c55e" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
