"use client";
import { useEffect, useState, useCallback } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Cell, LabelList,
} from "recharts";

interface ModeloItem {
  dispositivo: string;
  cantidad: number;
}
interface DecosData {
  iptv: ModeloItem[];
  ott:  ModeloItem[];
}

const IPTV_COLORS = ["#7c3aed","#8b5cf6","#a78bfa","#6d28d9","#5b21b6","#4c1d95","#c4b5fd"];
const OTT_COLORS  = ["#0891b2","#06b6d4","#67e8f9","#0e7490","#155e75","#164e63","#a5f3fc"];

function fmt(n: number) { return n.toLocaleString("es-AR"); }

interface BarData {
  dispositivo: string;
  cantidad: number;
  color: string;
}

function CustomTooltip({ active, payload, total }: {
  active?: boolean;
  payload?: { payload: BarData }[];
  total: number;
}) {
  if (!active || !payload?.length) return null;
  const { dispositivo, cantidad } = payload[0].payload;
  const pct = total > 0 ? ((cantidad / total) * 100).toFixed(1) : "0.0";
  return (
    <div className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 shadow-xl">
      <p className="text-white text-xs font-semibold mb-0.5">{dispositivo}</p>
      <p className="text-slate-300 text-xs">{fmt(cantidad)} decos — {pct}%</p>
    </div>
  );
}

function CategoryChart({
  data, colors, label,
}: { data: ModeloItem[]; colors: string[]; label: string }) {
  const total = data.reduce((s, d) => s + d.cantidad, 0);
  const chartData: BarData[] = data.map((d, i) => ({
    dispositivo: d.dispositivo,
    cantidad: d.cantidad,
    color: colors[i % colors.length],
  }));

  return (
    <div className="flex-1 min-w-0">
      <div className="flex items-center justify-between mb-3">
        <span className={`text-sm font-semibold ${label === "IPTV" ? "text-violet-400" : "text-cyan-400"}`}>
          {label}
        </span>
        <span className="text-slate-400 text-sm">{fmt(total)} decos</span>
      </div>
      <ResponsiveContainer width="100%" height={Math.max(data.length * 36 + 20, 80)}>
        <BarChart
          layout="vertical"
          data={chartData}
          margin={{ top: 0, right: 60, left: 8, bottom: 0 }}
          barSize={22}
        >
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="dispositivo"
            width={130}
            tick={{ fill: "#94a3b8", fontSize: 12 }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            cursor={{ fill: "rgba(255,255,255,0.04)" }}
            content={<CustomTooltip total={total} />}
          />
          <Bar dataKey="cantidad" radius={[0, 4, 4, 0]}>
            {chartData.map((entry, i) => (
              <Cell key={i} fill={entry.color} />
            ))}
            <LabelList
              dataKey="cantidad"
              position="right"
              formatter={(v: any) => fmt(Number(v) || 0)}
              style={{ fill: "#94a3b8", fontSize: 11 }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

interface Props {
  estados: number[];
  sucursal: number | null;
}

export default function DecosChart({ estados, sucursal }: Props) {
  const [data, setData] = useState<DecosData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (estados.length > 0) params.set("estados", estados.join(","));
      if (sucursal !== null) params.set("sucursal", String(sucursal));
      const res = await fetch(`/api/decos?${params.toString()}`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [estados, sucursal]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5">
      <h3 className="text-xs text-slate-500 uppercase tracking-wider font-medium mb-5">
        Desglose por modelo de deco
      </h3>

      {loading && (
        <div className="h-40 flex items-center justify-center text-slate-600 text-sm">
          Cargando...
        </div>
      )}
      {error && (
        <div className="text-red-400 text-sm">{error}</div>
      )}
      {data && !loading && (
        <div className="flex gap-8">
          <CategoryChart data={data.iptv} colors={IPTV_COLORS} label="IPTV" />
          <div className="w-px bg-slate-700 flex-shrink-0" />
          <CategoryChart data={data.ott} colors={OTT_COLORS} label="OTT" />
        </div>
      )}
    </div>
  );
}
