"use client";
import { useState, useEffect } from "react";
import { RotateCcw, X } from "lucide-react";

interface HistoryEntry {
  ts: string;
  description: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onRestored: () => void;
}

export default function HistoryPanel({ open, onClose, onRestored }: Props) {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [restoring, setRestoring] = useState<number | null>(null);

  useEffect(() => {
    if (open)
      fetch("/api/history")
        .then((r) => r.json())
        .then(setEntries)
        .catch(() => {});
  }, [open]);

  const restore = async (index: number) => {
    if (!confirm("¿Restaurar este estado? Los datos actuales se perderán.")) return;
    setRestoring(index);
    await fetch("/api/history", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ index }),
    });
    setRestoring(null);
    onClose();
    onRestored();
  };

  const fmt = (ts: string) => {
    const d = new Date(ts);
    return d.toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  };

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40" onClick={onClose} />

      {/* Panel */}
      <div className="fixed right-6 top-16 w-96 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
          <h3 className="text-slate-200 font-semibold text-sm">Historial de cambios</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300">
            <X size={16} />
          </button>
        </div>
        <div className="max-h-80 overflow-y-auto">
          {entries.length === 0 ? (
            <p className="text-slate-500 text-sm text-center py-6">Sin historial aún</p>
          ) : (
            entries.map((e, i) => (
              <div
                key={i}
                className="flex items-start justify-between gap-3 px-4 py-3 border-b border-slate-800/60 hover:bg-slate-800/40"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-300 truncate">{e.description}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{fmt(e.ts)}</p>
                </div>
                <button
                  onClick={() => restore(i)}
                  disabled={restoring === i}
                  className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 disabled:opacity-50 flex-shrink-0"
                >
                  <RotateCcw size={12} />
                  {restoring === i ? "..." : "Restaurar"}
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}
