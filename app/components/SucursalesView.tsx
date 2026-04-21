"use client";
import { useState, useEffect, useMemo } from "react";
import { X, Plus, Wifi, AlertTriangle, TrendingUp, TrendingDown, Minus, Trash2, Pencil } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from "recharts";
import { getColor } from "../lib/dataUtils";
import { useTheme } from "../lib/useTheme";

// ─── Types ───────────────────────────────────────────────────────────────────
interface SucursalRecord {
  id: string;
  sucursal: string;
  fecha: string; // YYYY-MM-DDTHH:MM
  trafico: number; // Mbps
  conexiones: number;
  dispositivos?: number;
  descripcion?: string;
}

type ChartRow = { fecha: string; [key: string]: string | number | undefined };

const STORAGE_KEY    = "qvix_sucursales_data";
const THRESHOLD_KEY  = "qvix_sucursales_threshold";

// ─── Helpers ─────────────────────────────────────────────────────────────────
function linReg(xs: number[], ys: number[]): { m: number; b: number } {
  const n = xs.length;
  if (n < 2) return { m: 0, b: ys[0] ?? 0 };
  const sx  = xs.reduce((a, v) => a + v, 0);
  const sy  = ys.reduce((a, v) => a + v, 0);
  const sxy = xs.reduce((a, v, i) => a + v * ys[i], 0);
  const sx2 = xs.reduce((a, v) => a + v * v, 0);
  const m   = (n * sxy - sx * sy) / (n * sx2 - sx * sx) || 0;
  const b   = (sy - m * sx) / n;
  return { m, b };
}

function nowDatetime(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}T${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
}

function fmtDatetime(dt: string): string {
  // "2026-04-21T14:30" → "21/04 14:30"
  try {
    const d = new Date(dt);
    const dd = String(d.getDate()).padStart(2,"0");
    const mm = String(d.getMonth()+1).padStart(2,"0");
    const hh = String(d.getHours()).padStart(2,"0");
    const min = String(d.getMinutes()).padStart(2,"0");
    return `${dd}/${mm} ${hh}:${min}`;
  } catch { return dt; }
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  // Preserve time portion if present
  const time = dateStr.includes("T") ? dateStr.slice(10) : "T00:00";
  return d.toISOString().slice(0, 10) + time;
}

function msBetween(d1: string, d2: string): number {
  return new Date(d2).getTime() - new Date(d1).getTime();
}

// ─── Component ───────────────────────────────────────────────────────────────
export default function SucursalesView({
  onClose,
  gotvOrgs = [],
}: {
  onClose: () => void;
  gotvOrgs?: string[];
}) {
  const { chart } = useTheme();

  // Data
  const [records, setRecords] = useState<SucursalRecord[]>([]);

  // Filters
  const [selectedSucs, setSelectedSucs] = useState<string[]>([]);
  const [fechaFrom, setFechaFrom]        = useState("");
  const [fechaTo, setFechaTo]            = useState("");
  const [horizonte, setHorizonte]        = useState(7);
  const [threshold, setThreshold]        = useState(0);
  const [editThresh, setEditThresh]      = useState(false);
  const [threshInput, setThreshInput]    = useState("0");

  // Form
  const [showForm, setShowForm]          = useState(false);
  const [editingId, setEditingId]        = useState<string | null>(null);
  const [fSucursal, setFSucursal]        = useState("");
  const [fFecha, setFFecha]              = useState(nowDatetime);
  const [fTrafico, setFTrafico]          = useState("");
  const [fConexiones, setFConexiones]    = useState("");
  const [fDispositivos, setFDispositivos] = useState("");
  const [fDescripcion, setFDescripcion]  = useState("");
  const [fError, setFError]              = useState("");

  // ── Load: API first, localStorage as fallback ──────────────────────────────
  useEffect(() => {
    // Threshold (localStorage only)
    const t = localStorage.getItem(THRESHOLD_KEY);
    if (t) { const n = parseFloat(t); if (!isNaN(n)) { setThreshold(n); setThreshInput(String(n)); } }

    // Records: try server file first, fall back to localStorage
    fetch("/api/sucursales")
      .then(r => r.json())
      .then((data: SucursalRecord[]) => {
        if (Array.isArray(data) && data.length > 0) {
          setRecords(data);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); // keep in sync
        } else {
          // Server file empty or new — try localStorage
          try {
            const d = localStorage.getItem(STORAGE_KEY);
            if (d) {
              const parsed: SucursalRecord[] = JSON.parse(d);
              setRecords(parsed);
              // migrate existing localStorage data up to server
              if (parsed.length > 0) {
                fetch("/api/sucursales", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(parsed),
                }).catch(() => {});
              }
            }
          } catch {}
        }
      })
      .catch(() => {
        // API unreachable — use localStorage
        try {
          const d = localStorage.getItem(STORAGE_KEY);
          if (d) setRecords(JSON.parse(d));
        } catch {}
      });
  }, []);

  const saveRecords = (recs: SucursalRecord[]) => {
    setRecords(recs);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(recs));
    // Persist to server file (fire and forget)
    fetch("/api/sucursales", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(recs),
    }).catch(() => {}); // silently ignore network errors
  };

  // ── Derived ────────────────────────────────────────────────────────────────
  // All known sucursales = GOTV orgs + any already entered in this view
  const allSucs = useMemo(
    () => [...new Set([...gotvOrgs, ...records.map(r => r.sucursal)])].sort(),
    [records, gotvOrgs]
  );

  // Auto-select all sucursales on first load
  useEffect(() => {
    if (selectedSucs.length === 0 && allSucs.length > 0) setSelectedSucs(allSucs);
  }, [allSucs]); // eslint-disable-line react-hooks/exhaustive-deps

  const activeSucs = selectedSucs.length > 0 ? selectedSucs : allSucs;

  // ── Form helpers ───────────────────────────────────────────────────────────
  const openNew = () => {
    setEditingId(null);
    setFSucursal(""); setFFecha(nowDatetime()); setFTrafico(""); setFConexiones("");
    setFDispositivos(""); setFDescripcion(""); setFError("");
    setShowForm(true);
  };

  const openEdit = (r: SucursalRecord) => {
    setEditingId(r.id);
    setFSucursal(r.sucursal);
    setFFecha(r.fecha);
    setFTrafico(String(r.trafico));
    setFConexiones(String(r.conexiones));
    setFDispositivos(r.dispositivos != null ? String(r.dispositivos) : "");
    setFDescripcion(r.descripcion ?? "");
    setFError("");
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false); setEditingId(null);
    setFSucursal(""); setFTrafico(""); setFConexiones("");
    setFDispositivos(""); setFDescripcion(""); setFError("");
  };

  // ── Add / update record ────────────────────────────────────────────────────
  const saveRecord = () => {
    setFError("");
    if (!fSucursal.trim() || !fFecha || !fTrafico || !fConexiones) {
      setFError("Todos los campos son obligatorios."); return;
    }
    const trafico    = parseFloat(fTrafico);
    const conexiones = parseInt(fConexiones, 10);
    if (isNaN(trafico) || trafico <= 0 || isNaN(conexiones) || conexiones <= 0) {
      setFError("Tráfico y conexiones deben ser números positivos."); return;
    }
    const dispositivos = fDispositivos ? parseInt(fDispositivos, 10) : undefined;
    const descripcion  = fDescripcion.trim() || undefined;

    if (editingId) {
      saveRecords(records.map(r =>
        r.id === editingId
          ? { ...r, sucursal: fSucursal.trim(), fecha: fFecha, trafico, conexiones, dispositivos, descripcion }
          : r
      ));
    } else {
      saveRecords([...records, {
        id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        sucursal: fSucursal.trim(),
        fecha: fFecha,
        trafico,
        conexiones,
        dispositivos,
        descripcion,
      }]);
    }
    closeForm();
  };

  const deleteRecord = (id: string) => {
    if (!confirm("¿Eliminar este registro?")) return;
    saveRecords(records.filter(r => r.id !== id));
  };

  const applyThreshold = () => {
    const n = parseFloat(threshInput);
    if (!isNaN(n) && n >= 0) {
      setThreshold(n);
      localStorage.setItem(THRESHOLD_KEY, String(n));
    }
    setEditThresh(false);
  };

  // ── Chart data ─────────────────────────────────────────────────────────────
  const { traficoData, conexionesData } = useMemo<{
    traficoData: ChartRow[];
    conexionesData: ChartRow[];
  }>(() => {
    if (records.length === 0) return { traficoData: [], conexionesData: [] };

    const realDates = [...new Set(
      records.filter(r => activeSucs.includes(r.sucursal)).map(r => r.fecha)
    )].sort();

    if (realDates.length === 0) return { traficoData: [], conexionesData: [] };

    const firstDate = realDates[0];
    const lastDate  = realDates[realDates.length - 1];
    const projDates = Array.from({ length: horizonte }, (_, i) => addDays(lastDate, i + 1));
    const allDates  = [...realDates, ...projDates];

    const tRows: ChartRow[] = allDates.map(d => ({ fecha: d }));
    const cRows: ChartRow[] = allDates.map(d => ({ fecha: d }));

    for (const suc of activeSucs) {
      const sucRecs = records
        .filter(r => r.sucursal === suc)
        .sort((a, b) => a.fecha.localeCompare(b.fecha));

      // Real data
      sucRecs.forEach(rec => {
        const idx = allDates.indexOf(rec.fecha);
        if (idx >= 0) {
          tRows[idx][suc] = rec.trafico;
          cRows[idx][suc] = rec.conexiones;
        }
      });

      // Projection (need ≥2 points for regression)
      if (sucRecs.length >= 2) {
        const xs = sucRecs.map(r => msBetween(firstDate, r.fecha));
        const regT = linReg(xs, sucRecs.map(r => r.trafico));
        const regC = linReg(xs, sucRecs.map(r => r.conexiones));
        const key  = `${suc}_proy`;

        // Bridge: projected value at last real date
        const xLast = msBetween(firstDate, lastDate);
        const lastRealIdx = allDates.indexOf(lastDate);
        if (lastRealIdx >= 0) {
          tRows[lastRealIdx][key] = Math.max(0, +(regT.m * xLast + regT.b).toFixed(2));
          cRows[lastRealIdx][key] = Math.max(0, Math.round(regC.m * xLast + regC.b));
        }

        // Projected future dates
        projDates.forEach(d => {
          const x   = msBetween(firstDate, d);
          const idx = allDates.indexOf(d);
          if (idx >= 0) {
            tRows[idx][key] = Math.max(0, +(regT.m * x + regT.b).toFixed(2));
            cRows[idx][key] = Math.max(0, Math.round(regC.m * x + regC.b));
          }
        });
      }
    }

    return { traficoData: tRows, conexionesData: cRows };
  }, [records, activeSucs, horizonte]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── KPI per sucursal ───────────────────────────────────────────────────────
  const kpis = useMemo(() => activeSucs.map(suc => {
    const recs = records.filter(r => r.sucursal === suc).sort((a, b) => a.fecha.localeCompare(b.fecha));
    if (recs.length === 0) return null;
    const last     = recs[recs.length - 1];
    const prev     = recs[recs.length - 2];
    const avgT     = recs.reduce((s, r) => s + r.trafico, 0) / recs.length;
    const maxT     = Math.max(...recs.map(r => r.trafico));
    const trend    = prev
      ? last.trafico > prev.trafico ? "up" : last.trafico < prev.trafico ? "down" : "flat"
      : "flat";
    return { suc, avgT, maxT, lastT: last.trafico, lastC: last.conexiones, trend };
  }).filter(Boolean), [records, activeSucs]);

  // ── Table data ─────────────────────────────────────────────────────────────
  const tableRecords = useMemo(() =>
    records
      .filter(r => activeSucs.includes(r.sucursal))
      .filter(r => !fechaFrom || r.fecha >= fechaFrom)
      .filter(r => !fechaTo   || r.fecha <= fechaTo)
      .sort((a, b) => b.fecha.localeCompare(a.fecha)),
    [records, activeSucs, fechaFrom, fechaTo]
  );

  const toggleSuc = (s: string) =>
    setSelectedSucs(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <div className="max-w-screen-xl mx-auto px-6 py-8 space-y-6">

        {/* ── Header ── */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
              <Wifi size={20} className="text-sky-400" /> Monitoreo de Sucursales
            </h2>
            <p className="text-sm text-slate-400 mt-0.5">Tráfico y conexiones — historial + proyección</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={openNew}
              className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
            >
              <Plus size={15} /> Nueva entrada
            </button>
            <button
              onClick={onClose}
              className="flex items-center gap-1.5 text-slate-400 hover:text-slate-200 border border-slate-700 hover:border-slate-500 px-3 py-1.5 rounded-lg text-sm transition-colors"
            >
              <X size={15} /> Volver
            </button>
          </div>
        </div>

        {/* ── Form modal ── */}
        {showForm && (
          <div
            className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
            onClick={closeForm}
          >
            <div
              className="bg-slate-800 border border-slate-700 rounded-2xl p-6 w-full max-w-md space-y-4"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-slate-200 font-semibold">
                  {editingId ? "Editar entrada" : "Nueva entrada"}
                </h3>
                <button onClick={closeForm} className="text-slate-500 hover:text-slate-300">
                  <X size={16} />
                </button>
              </div>

              {[
                {
                  label: "Sucursal *",
                  el: (
                    <>
                      <input
                        list="sucs-list"
                        value={fSucursal}
                        onChange={e => setFSucursal(e.target.value)}
                        placeholder="Ej: Central, Norte, Sur…"
                        className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                      />
                      <datalist id="sucs-list">
                        {allSucs.map(s => <option key={s} value={s} />)}
                      </datalist>
                    </>
                  ),
                },
                {
                  label: "Fecha *",
                  el: (
                    <input type="datetime-local" value={fFecha} onChange={e => setFFecha(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500" />
                  ),
                },
                {
                  label: "Pico de tráfico (Mbps) *",
                  el: (
                    <input type="number" min="0" step="0.1" value={fTrafico}
                      onChange={e => setFTrafico(e.target.value)} placeholder="Ej: 250.5"
                      className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500" />
                  ),
                },
                {
                  label: "Cantidad de conexiones *",
                  el: (
                    <input type="number" min="0" step="1" value={fConexiones}
                      onChange={e => setFConexiones(e.target.value)} placeholder="Ej: 120"
                      className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500" />
                  ),
                },
                {
                  label: "Dispositivos activos",
                  el: (
                    <input type="number" min="0" step="1" value={fDispositivos}
                      onChange={e => setFDispositivos(e.target.value)} placeholder="Ej: 850"
                      className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500" />
                  ),
                },
                {
                  label: "Descripción / motivo del pico",
                  el: (
                    <input type="text" value={fDescripcion}
                      onChange={e => setFDescripcion(e.target.value)}
                      placeholder="Ej: Partido de fútbol, evento especial…"
                      className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500" />
                  ),
                },
              ].map(({ label, el }) => (
                <div key={label}>
                  <label className="text-xs text-slate-400 block mb-1">{label}</label>
                  {el}
                </div>
              ))}

              {fError && (
                <div className="flex items-center gap-2 text-red-400 text-xs">
                  <AlertTriangle size={13} />{fError}
                </div>
              )}

              <div className="flex gap-2 justify-end pt-1">
                <button onClick={closeForm}
                  className="text-sm text-slate-400 hover:text-slate-200 px-3 py-1.5 transition-colors">
                  Cancelar
                </button>
                <button onClick={saveRecord}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium px-4 py-1.5 rounded-lg transition-colors">
                  {editingId ? "Actualizar" : "Guardar"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Empty state ── */}
        {records.length === 0 ? (
          <div className="text-center py-24 text-slate-600">
            <Wifi size={52} className="mx-auto mb-4 opacity-20" />
            <p className="text-lg">Sin datos de sucursales</p>
            <p className="text-sm mt-1">
              Usá <span className="text-indigo-400 font-medium">Nueva entrada</span> para agregar registros
            </p>
          </div>
        ) : (
          <>
            {/* ── Filters ── */}
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
              <div className="flex flex-wrap gap-4 items-end">

                {/* Sucursal chips */}
                <div className="flex-1 min-w-56">
                  <p className="text-xs text-slate-400 mb-2">Sucursales</p>
                  <div className="flex flex-wrap gap-2">
                    {allSucs.length > 1 && (
                      <button
                        onClick={() => setSelectedSucs(allSucs)}
                        className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                          selectedSucs.length === allSucs.length
                            ? "bg-indigo-600 border-indigo-500 text-white"
                            : "border-slate-600 text-slate-400 hover:border-slate-400"
                        }`}
                      >
                        Todas
                      </button>
                    )}
                    {allSucs.map((s) => {
                      const color   = getColor(s, allSucs.indexOf(s));
                      const active  = selectedSucs.includes(s);
                      return (
                        <button key={s} onClick={() => toggleSuc(s)}
                          className="px-3 py-1 rounded-full text-xs font-medium border transition-colors"
                          style={active
                            ? { backgroundColor: color, borderColor: color, color: "#fff" }
                            : { borderColor: "#475569", color: "#94a3b8" }}
                        >
                          {s}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Date range */}
                <div>
                  <p className="text-xs text-slate-400 mb-1">Desde</p>
                  <input type="datetime-local" value={fechaFrom} onChange={e => setFechaFrom(e.target.value)}
                    className="bg-slate-900 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-indigo-500" />
                </div>
                <div>
                  <p className="text-xs text-slate-400 mb-1">Hasta</p>
                  <input type="datetime-local" value={fechaTo} onChange={e => setFechaTo(e.target.value)}
                    className="bg-slate-900 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-indigo-500" />
                </div>

                {/* Projection horizon */}
                <div>
                  <p className="text-xs text-slate-400 mb-1">Proyección</p>
                  <select value={horizonte} onChange={e => setHorizonte(Number(e.target.value))}
                    className="bg-slate-900 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-indigo-500">
                    <option value={7}>7 días</option>
                    <option value={15}>15 días</option>
                    <option value={30}>30 días</option>
                  </select>
                </div>

                {/* Threshold */}
                <div>
                  <p className="text-xs text-slate-400 mb-1">Alerta tráfico (Mbps)</p>
                  {editThresh ? (
                    <div className="flex gap-1">
                      <input
                        type="number" min="0" value={threshInput}
                        onChange={e => setThreshInput(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter") applyThreshold(); if (e.key === "Escape") setEditThresh(false); }}
                        autoFocus
                        className="w-24 bg-slate-900 border border-amber-600 rounded-lg px-2 py-1.5 text-sm text-slate-200 focus:outline-none"
                      />
                      <button onClick={applyThreshold}
                        className="bg-amber-700 hover:bg-amber-600 text-white text-xs px-2 rounded-lg transition-colors">
                        OK
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => { setThreshInput(String(threshold)); setEditThresh(true); }}
                      className="flex items-center gap-1.5 bg-slate-900 border border-slate-600 hover:border-amber-600 rounded-lg px-3 py-1.5 text-sm text-slate-200 transition-colors min-w-24">
                      {threshold > 0 ? `${threshold} Mbps` : "Sin alerta"}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* ── KPI Cards ── */}
            {kpis.length > 0 && (
              <div className="flex flex-row gap-3 overflow-x-auto pb-1">
                {kpis.map(k => {
                  if (!k) return null;
                  const color        = getColor(k.suc, allSucs.indexOf(k.suc));
                  const isAlert      = threshold > 0 && k.lastT > threshold;
                  return (
                    <div key={k.suc}
                      className="bg-slate-800 border border-slate-700 rounded-xl p-4 relative overflow-hidden flex-1 min-w-[170px]"
                      style={{ borderLeftColor: color, borderLeftWidth: 3 }}
                    >
                      {isAlert && (
                        <div className="absolute top-2 right-2 flex items-center gap-1 text-amber-400 text-xs">
                          <AlertTriangle size={13} /> Alerta
                        </div>
                      )}
                      <div className="text-xs font-bold mb-3 truncate" style={{ color }}>{k.suc}</div>
                      <div className="space-y-2 text-sm">
                        {[
                          { label: "Último pico", val: `${k.lastT} Mbps`, highlight: isAlert },
                          { label: "Promedio",    val: `${k.avgT.toFixed(1)} Mbps` },
                          { label: "Máx histórico", val: `${k.maxT} Mbps` },
                          { label: "Conexiones",  val: k.lastC.toLocaleString() },
                        ].map(({ label, val, highlight }) => (
                          <div key={label} className="flex justify-between items-center">
                            <span className="text-xs text-slate-500">{label}</span>
                            <span className={`font-mono font-medium ${highlight ? "text-amber-400" : "text-slate-200"}`}>
                              {val}
                            </span>
                          </div>
                        ))}
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-slate-500">Tendencia</span>
                          {k.trend === "up"   ? <TrendingUp  size={15} className="text-emerald-400" /> :
                           k.trend === "down" ? <TrendingDown size={15} className="text-red-400" /> :
                           <Minus size={15} className="text-slate-500" />}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── Charts ── */}
            <div className="space-y-5">
              {(["trafico", "conexiones"] as const).map(tipo => {
                const data  = tipo === "trafico" ? traficoData : conexionesData;
                const title = tipo === "trafico" ? "Tráfico (Mbps)" : "Conexiones";
                const unit  = tipo === "trafico" ? " Mbps" : "";
                const fmt   = tipo === "trafico"
                  ? (v: number) => `${Number(v).toFixed(1)} Mbps`
                  : (v: number) => Math.round(Number(v)).toLocaleString();

                return (
                  <div key={tipo} className="bg-slate-800 border border-slate-700 rounded-xl p-5">
                    <h3 className="text-slate-200 font-semibold mb-0.5">{title}</h3>
                    <p className="text-xs text-slate-500 mb-4">
                      Línea sólida = datos reales · Línea punteada = proyección ({horizonte} días)
                    </p>
                    <ResponsiveContainer width="100%" height={280}>
                      <LineChart data={data} margin={{ top: 4, right: 20, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} />
                        <XAxis dataKey="fecha" tick={{ fill: chart.axis, fontSize: 10 }} tickFormatter={fmtDatetime} />
                        <YAxis tick={{ fill: chart.axis, fontSize: 10 }} unit={unit} />
                        <Tooltip
                          contentStyle={{ backgroundColor: chart.tooltipBg, border: `1px solid ${chart.tooltipBorder}`, borderRadius: 8 }}
                          labelStyle={{ color: chart.tooltipLabel }}
                          formatter={(v: unknown, name: unknown) => {
                            const n = String(name ?? "");
                            return [fmt(Number(v)), n.endsWith("_proy") ? `${n.replace("_proy", "")} (proy)` : n];
                          }}
                        />
                        <Legend formatter={v => (
                          <span style={{ color: chart.legend, fontSize: 11 }}>
                            {v.endsWith("_proy") ? `${v.replace("_proy", "")} (proy)` : v}
                          </span>
                        )} />
                        {tipo === "trafico" && threshold > 0 && (
                          <ReferenceLine
                            y={threshold}
                            stroke="#f59e0b"
                            strokeDasharray="4 2"
                            label={{ value: `Alerta ${threshold} Mbps`, fill: "#f59e0b", fontSize: 10, position: "insideTopLeft" }}
                          />
                        )}
                        {activeSucs.flatMap(suc => {
                          const color = getColor(suc, allSucs.indexOf(suc));
                          return [
                            <Line key={suc} type="monotone" dataKey={suc}
                              stroke={color} strokeWidth={2} dot={{ r: 3 }} connectNulls={false} />,
                            <Line key={`${suc}_proy`} type="monotone" dataKey={`${suc}_proy`}
                              stroke={color} strokeWidth={1.5} strokeDasharray="5 3"
                              dot={false} connectNulls={false} legendType="none" />,
                          ];
                        })}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                );
              })}
            </div>

            {/* ── Table ── */}
            <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-700 flex items-center justify-between">
                <h3 className="text-slate-200 font-semibold">Historial</h3>
                <span className="text-xs text-slate-500">{tableRecords.length} registros</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-700 text-xs text-slate-500 uppercase tracking-wider">
                      <th className="py-3 px-5 text-left">Sucursal</th>
                      <th className="py-3 px-5 text-left">Fecha</th>
                      <th className="py-3 px-5 text-right">Tráfico (Mbps)</th>
                      <th className="py-3 px-5 text-right">Conexiones</th>
                      <th className="py-3 px-5 text-right">Dispositivos</th>
                      <th className="py-3 px-5 text-left">Descripción</th>
                      <th className="py-3 px-5 text-center">Alerta</th>
                      <th className="py-3 px-5 text-center" />
                    </tr>
                  </thead>
                  <tbody>
                    {tableRecords.map(r => {
                      const isAlert = threshold > 0 && r.trafico > threshold;
                      const color   = getColor(r.sucursal, allSucs.indexOf(r.sucursal));
                      return (
                        <tr key={r.id} className="border-b border-slate-700/50 hover:bg-slate-700/20">
                          <td className="py-3 px-5 font-semibold text-sm" style={{ color }}>{r.sucursal}</td>
                          <td className="py-3 px-5 font-mono text-slate-300">{fmtDatetime(r.fecha)}</td>
                          <td className={`py-3 px-5 text-right font-mono font-bold ${isAlert ? "text-amber-400" : "text-slate-200"}`}>
                            {r.trafico}
                          </td>
                          <td className="py-3 px-5 text-right font-mono text-slate-300">
                            {r.conexiones.toLocaleString()}
                          </td>
                          <td className="py-3 px-5 text-right font-mono text-slate-300">
                            {r.dispositivos != null ? r.dispositivos.toLocaleString() : <span className="text-slate-600">—</span>}
                          </td>
                          <td className="py-3 px-5 text-sm text-slate-400 max-w-[200px] truncate" title={r.descripcion}>
                            {r.descripcion || <span className="text-slate-600">—</span>}
                          </td>
                          <td className="py-3 px-5 text-center">
                            {isAlert && <AlertTriangle size={14} className="text-amber-400 mx-auto" />}
                          </td>
                          <td className="py-3 px-5 text-center">
                            <div className="flex items-center justify-center gap-3">
                              <button onClick={() => openEdit(r)}
                                className="text-slate-600 hover:text-indigo-400 transition-colors">
                                <Pencil size={14} />
                              </button>
                              <button onClick={() => deleteRecord(r.id)}
                                className="text-slate-600 hover:text-red-400 transition-colors">
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {tableRecords.length === 0 && (
                      <tr>
                        <td colSpan={8} className="py-10 text-center text-slate-600">
                          Sin registros con los filtros seleccionados.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
