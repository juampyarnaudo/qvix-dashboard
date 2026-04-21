"use client";
import { useState, useEffect } from "react";
import { Target, Check, X } from "lucide-react";
import type { OrgStats } from "../lib/types";

interface Props {
  orgStats: OrgStats[];
  servicio: string;
}

type Goals = Record<string, { stb: number; movil: number }>;

export default function GoalsPanel({ orgStats, servicio }: Props) {
  const storageKey = `goals_${servicio}`;
  const [goals, setGoals] = useState<Goals>({});
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState({ stb: "", movil: "" });

  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) setGoals(JSON.parse(stored));
    } catch {}
  }, [storageKey]);

  const save = (org: string) => {
    const updated = {
      ...goals,
      [org]: { stb: parseInt(draft.stb) || 0, movil: parseInt(draft.movil) || 0 },
    };
    setGoals(updated);
    localStorage.setItem(storageKey, JSON.stringify(updated));
    setEditing(null);
  };

  const remove = (org: string) => {
    const updated = { ...goals };
    delete updated[org];
    setGoals(updated);
    localStorage.setItem(storageKey, JSON.stringify(updated));
  };

  const startEdit = (org: string) => {
    const g = goals[org] ?? { stb: 0, movil: 0 };
    setDraft({ stb: String(g.stb || ""), movil: String(g.movil || "") });
    setEditing(org);
  };

  const pct = (value: number, goal: number) =>
    goal > 0 ? Math.min(100, Math.round((value / goal) * 100)) : 0;

  const ProgressBar = ({ value, goal, color }: { value: number; goal: number; color: string }) => {
    const p = pct(value, goal);
    return (
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${p}%`, backgroundColor: color }}
          />
        </div>
        <span className="text-xs font-mono text-slate-400 w-8 text-right">{p}%</span>
      </div>
    );
  };

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <Target size={16} className="text-amber-400" />
        <h3 className="text-slate-200 font-semibold">Metas por organización</h3>
      </div>
      <div className="space-y-4">
        {orgStats.map((o) => {
          const last = o.datos.at(-1)!;
          const goal = goals[o.organizacion];
          const isEditing = editing === o.organizacion;
          return (
            <div key={o.organizacion} className="border border-slate-700/60 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-slate-200 font-medium text-sm">{o.organizacion}</span>
                <div className="flex gap-2">
                  {goal && (
                    <button onClick={() => remove(o.organizacion)} className="text-slate-600 hover:text-red-400 transition-colors">
                      <X size={13} />
                    </button>
                  )}
                  <button
                    onClick={() => isEditing ? setEditing(null) : startEdit(o.organizacion)}
                    className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                  >
                    {isEditing ? "Cancelar" : goal ? "Editar meta" : "Fijar meta"}
                  </button>
                </div>
              </div>

              {isEditing ? (
                <div className="flex gap-2 items-center mt-2">
                  <div className="flex-1">
                    <label className="text-xs text-slate-500 mb-0.5 block">Meta STB</label>
                    <input
                      type="number"
                      value={draft.stb}
                      onChange={(e) => setDraft((d) => ({ ...d, stb: e.target.value }))}
                      className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-xs text-slate-500 mb-0.5 block">Meta Móvil</label>
                    <input
                      type="number"
                      value={draft.movil}
                      onChange={(e) => setDraft((d) => ({ ...d, movil: e.target.value }))}
                      className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <button
                    onClick={() => save(o.organizacion)}
                    className="mt-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded px-3 py-1 text-xs"
                  >
                    <Check size={13} />
                  </button>
                </div>
              ) : goal ? (
                <div className="space-y-2 mt-1">
                  <div>
                    <div className="flex justify-between text-xs text-slate-500 mb-0.5">
                      <span>STB</span>
                      <span>{last.stb.toLocaleString()} / {goal.stb.toLocaleString()}</span>
                    </div>
                    <ProgressBar value={last.stb} goal={goal.stb} color="#6366f1" />
                  </div>
                  <div>
                    <div className="flex justify-between text-xs text-slate-500 mb-0.5">
                      <span>Móvil</span>
                      <span>{last.movil.toLocaleString()} / {goal.movil.toLocaleString()}</span>
                    </div>
                    <ProgressBar value={last.movil} goal={goal.movil} color="#22c55e" />
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-600 italic">Sin meta definida</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
