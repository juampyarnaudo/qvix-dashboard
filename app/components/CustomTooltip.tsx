"use client";

interface Payload {
  name: string;
  value: number;
  color: string;
}

interface Props {
  active?: boolean;
  payload?: readonly Payload[];
  label?: string;
  prevData?: Record<string, number>; // datos del período anterior para mostrar variación
}

export default function CustomTooltip({ active, payload, label, prevData }: Props) {
  if (!active || !payload?.length) return null;

  const total = payload.reduce((s, p) => s + (p.value ?? 0), 0);

  return (
    <div className="bg-slate-900 border border-slate-600 rounded-xl shadow-2xl p-3 min-w-[180px]">
      <p className="text-slate-300 font-semibold text-xs mb-2 border-b border-slate-700 pb-1">{label}</p>
      {payload.map((p) => {
        const prev = prevData?.[p.name];
        const diff = prev !== undefined && prev > 0
          ? Math.round(((p.value - prev) / prev) * 100)
          : null;
        return (
          <div key={p.name} className="flex items-center justify-between gap-4 py-0.5">
            <span className="flex items-center gap-1.5 text-xs text-slate-400">
              <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: p.color }} />
              {p.name}
            </span>
            <span className="text-xs font-mono text-slate-200 font-semibold">
              {p.value.toLocaleString()}
              {diff !== null && (
                <span className={`ml-1.5 font-normal ${diff > 0 ? "text-emerald-400" : diff < 0 ? "text-red-400" : "text-slate-500"}`}>
                  {diff > 0 ? "+" : ""}{diff}%
                </span>
              )}
            </span>
          </div>
        );
      })}
      {payload.length > 1 && (
        <div className="flex items-center justify-between gap-4 pt-1 mt-1 border-t border-slate-700">
          <span className="text-xs text-slate-500">Total</span>
          <span className="text-xs font-mono text-slate-300 font-semibold">{total.toLocaleString()}</span>
        </div>
      )}
    </div>
  );
}
