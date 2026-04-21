"use client";
import { TrendingUp, TrendingDown, Minus, Monitor, Smartphone } from "lucide-react";
import type { Summary } from "../lib/types";

interface Props {
  summaries: Summary[];
}

const TrendIcon = ({ t }: { t: "sube" | "baja" | "estable" }) => {
  if (t === "sube") return <TrendingUp size={14} className="text-emerald-400" />;
  if (t === "baja") return <TrendingDown size={14} className="text-red-400" />;
  return <Minus size={14} className="text-slate-400" />;
};

const diffColor = (v?: number) => {
  if (v === undefined) return "text-slate-500";
  if (v > 0) return "text-emerald-400";
  if (v < 0) return "text-red-400";
  return "text-slate-400";
};

export default function SummaryCards({ summaries }: Props) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
      {summaries.map((s) => (
        <div key={s.organizacion} className="bg-slate-800 border border-slate-700 rounded-xl p-4 space-y-3">
          <div className="text-slate-200 font-semibold text-sm truncate">{s.organizacion}</div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1 text-slate-400 text-xs">
                <Monitor size={12} /> STB
              </div>
              <div className="flex items-center gap-1">
                <TrendIcon t={s.stbTendencia} />
                <span className={`text-xs font-mono ${diffColor(s.stbDiffUltimo)}`}>
                  {s.stbDiffUltimo !== undefined ? `${s.stbDiffUltimo > 0 ? "+" : ""}${s.stbDiffUltimo}%` : "-"}
                </span>
              </div>
            </div>
            <div className="text-xl font-bold text-white">{s.stbActual.toLocaleString()}</div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1 text-slate-400 text-xs">
                <Smartphone size={12} /> Móvil
              </div>
              <div className="flex items-center gap-1">
                <TrendIcon t={s.movilTendencia} />
                <span className={`text-xs font-mono ${diffColor(s.movilDiffUltimo)}`}>
                  {s.movilDiffUltimo !== undefined ? `${s.movilDiffUltimo > 0 ? "+" : ""}${s.movilDiffUltimo}%` : "-"}
                </span>
              </div>
            </div>
            <div className="text-xl font-bold text-white">{s.movilActual.toLocaleString()}</div>
          </div>

          <div className="text-xs text-slate-500 pt-1 border-t border-slate-700">
            Total: {(s.stbActual + s.movilActual).toLocaleString()}
          </div>
        </div>
      ))}
    </div>
  );
}
