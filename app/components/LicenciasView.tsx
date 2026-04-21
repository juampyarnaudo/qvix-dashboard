"use client";
import { useState, useEffect } from "react";
import { X, Monitor, Smartphone, Key, AlertTriangle } from "lucide-react";

interface Props {
  gotvStb: number;
  gotvMovil: number;
  viewtvStb: number;
  viewtvMovil: number;
  onClose: () => void;
}

const STORAGE_KEY = "qvix_total_licencias";
const DEFAULT_LICENCIAS = 25000;

function getUsageColor(pct: number) {
  if (pct < 60) return {
    text: "text-emerald-400",
    bar: "bg-emerald-500",
    badge: "bg-emerald-900/40 border border-emerald-700 text-emerald-400",
    label: "Margen seguro",
  };
  if (pct < 85) return {
    text: "text-amber-400",
    bar: "bg-amber-400",
    badge: "bg-amber-900/40 border border-amber-700 text-amber-400",
    label: "Atención",
  };
  return {
    text: "text-red-400",
    bar: "bg-red-500",
    badge: "bg-red-900/40 border border-red-700 text-red-400",
    label: pct >= 100 ? "Límite superado" : "Crítico",
  };
}

function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  const colors = getUsageColor(max > 0 ? (value / max) * 100 : 0);
  return (
    <div className="w-full bg-slate-700 rounded-full h-3 overflow-hidden">
      <div
        className={`h-3 rounded-full transition-all duration-500 ${colors.bar}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export default function LicenciasView({ gotvStb, gotvMovil, viewtvStb, viewtvMovil, onClose }: Props) {
  const [totalLicencias, setTotalLicencias] = useState(DEFAULT_LICENCIAS);
  const [inputValue, setInputValue] = useState(String(DEFAULT_LICENCIAS));
  const [editing, setEditing] = useState(false);

  // Load from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const n = parseInt(stored, 10);
      if (!isNaN(n) && n > 0) {
        setTotalLicencias(n);
        setInputValue(String(n));
      }
    }
  }, []);

  const applyLicencias = () => {
    const n = parseInt(inputValue.replace(/\D/g, ""), 10);
    if (!isNaN(n) && n > 0) {
      setTotalLicencias(n);
      localStorage.setItem(STORAGE_KEY, String(n));
    } else {
      setInputValue(String(totalLicencias));
    }
    setEditing(false);
  };

  const totalStb = gotvStb + viewtvStb;
  const totalMovil = gotvMovil + viewtvMovil;

  const stbPct = totalLicencias > 0 ? (totalStb / totalLicencias) * 100 : 0;
  const movilPct = totalLicencias > 0 ? (totalMovil / totalLicencias) * 100 : 0;
  const maxPct = Math.max(stbPct, movilPct);

  const stbColors = getUsageColor(stbPct);
  const movilColors = getUsageColor(movilPct);
  const globalColors = getUsageColor(maxPct);

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <div className="max-w-screen-xl mx-auto px-6 py-8 space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
              <Key size={20} className="text-indigo-400" />
              Control de Licencias
            </h2>
            <p className="text-sm text-slate-400 mt-0.5">
              Uso de licencias de plataforma — GOTV + ViewTV combinados
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 text-slate-400 hover:text-slate-200 border border-slate-700 hover:border-slate-500 px-3 py-1.5 rounded-lg text-sm transition-colors"
          >
            <X size={15} /> Volver al dashboard
          </button>
        </div>

        {/* Config de licencias */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 flex items-center gap-4 flex-wrap">
          <Key size={18} className="text-slate-500" />
          <span className="text-slate-300 text-sm font-medium">Total de licencias disponibles:</span>
          {editing ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") applyLicencias(); if (e.key === "Escape") { setEditing(false); setInputValue(String(totalLicencias)); } }}
                autoFocus
                className="bg-slate-900 border border-indigo-500 rounded-lg px-3 py-1.5 text-sm text-slate-200 focus:outline-none w-32 font-mono text-center"
              />
              <button
                onClick={applyLicencias}
                className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
              >
                Guardar
              </button>
              <button
                onClick={() => { setEditing(false); setInputValue(String(totalLicencias)); }}
                className="text-slate-500 hover:text-slate-300 text-sm px-2 py-1.5 transition-colors"
              >
                Cancelar
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-indigo-400 font-bold text-lg font-mono">
                {totalLicencias.toLocaleString()}
              </span>
              <button
                onClick={() => setEditing(true)}
                className="text-xs text-slate-500 hover:text-indigo-400 border border-slate-600 hover:border-indigo-500 px-2 py-0.5 rounded transition-colors"
              >
                Editar
              </button>
            </div>
          )}
          <p className="text-xs text-slate-500 ml-auto">
            Estas licencias aplican a STB y Móvil de forma independiente — el tope se alcanza cuando cualquiera llega al límite
          </p>
        </div>

        {/* Alerta si supera el tope */}
        {maxPct >= 100 && (
          <div className="flex items-center gap-2 text-red-400 bg-red-950/30 border border-red-800 rounded-lg px-4 py-3 text-sm">
            <AlertTriangle size={16} />
            Se superó el límite de licencias — revisá el plan de expansión.
          </div>
        )}

        {/* Cards STB y Móvil */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* STB Card */}
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Monitor size={18} className="text-indigo-400" />
                <h3 className="text-slate-200 font-semibold">STB (Decos)</h3>
              </div>
              <span className={`text-xs px-2.5 py-0.5 rounded-full ${stbColors.badge}`}>
                {stbColors.label}
              </span>
            </div>

            <div>
              <div className="flex items-end justify-between mb-2">
                <span className={`text-4xl font-bold font-mono ${stbColors.text}`}>
                  {totalStb.toLocaleString()}
                </span>
                <div className="text-right">
                  <div className={`text-2xl font-bold font-mono ${stbColors.text}`}>
                    {stbPct.toFixed(1)}%
                  </div>
                  <div className="text-xs text-slate-500">de {totalLicencias.toLocaleString()}</div>
                </div>
              </div>
              <ProgressBar value={totalStb} max={totalLicencias} />
              <div className="text-xs text-slate-500 mt-1">
                Disponibles: {Math.max(0, totalLicencias - totalStb).toLocaleString()} licencias
              </div>
            </div>

            {/* Desglose */}
            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-700">
              <div className="bg-slate-900/60 rounded-xl p-3">
                <div className="text-xs text-slate-500 mb-1">GOTV</div>
                <div className="text-xl font-bold text-purple-400 font-mono">{gotvStb.toLocaleString()}</div>
                <div className="text-xs text-slate-600 mt-0.5">
                  {totalStb > 0 ? Math.round((gotvStb / totalStb) * 100) : 0}% del total STB
                </div>
              </div>
              <div className="bg-slate-900/60 rounded-xl p-3">
                <div className="text-xs text-slate-500 mb-1">ViewTV</div>
                <div className="text-xl font-bold text-cyan-400 font-mono">{viewtvStb.toLocaleString()}</div>
                <div className="text-xs text-slate-600 mt-0.5">
                  {totalStb > 0 ? Math.round((viewtvStb / totalStb) * 100) : 0}% del total STB
                </div>
              </div>
            </div>
          </div>

          {/* Móvil Card */}
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Smartphone size={18} className="text-emerald-400" />
                <h3 className="text-slate-200 font-semibold">Móvil (App)</h3>
              </div>
              <span className={`text-xs px-2.5 py-0.5 rounded-full ${movilColors.badge}`}>
                {movilColors.label}
              </span>
            </div>

            <div>
              <div className="flex items-end justify-between mb-2">
                <span className={`text-4xl font-bold font-mono ${movilColors.text}`}>
                  {totalMovil.toLocaleString()}
                </span>
                <div className="text-right">
                  <div className={`text-2xl font-bold font-mono ${movilColors.text}`}>
                    {movilPct.toFixed(1)}%
                  </div>
                  <div className="text-xs text-slate-500">de {totalLicencias.toLocaleString()}</div>
                </div>
              </div>
              <ProgressBar value={totalMovil} max={totalLicencias} />
              <div className="text-xs text-slate-500 mt-1">
                Disponibles: {Math.max(0, totalLicencias - totalMovil).toLocaleString()} licencias
              </div>
            </div>

            {/* Desglose */}
            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-700">
              <div className="bg-slate-900/60 rounded-xl p-3">
                <div className="text-xs text-slate-500 mb-1">GOTV</div>
                <div className="text-xl font-bold text-purple-400 font-mono">{gotvMovil.toLocaleString()}</div>
                <div className="text-xs text-slate-600 mt-0.5">
                  {totalMovil > 0 ? Math.round((gotvMovil / totalMovil) * 100) : 0}% del total Móvil
                </div>
              </div>
              <div className="bg-slate-900/60 rounded-xl p-3">
                <div className="text-xs text-slate-500 mb-1">ViewTV</div>
                <div className="text-xl font-bold text-cyan-400 font-mono">{viewtvMovil.toLocaleString()}</div>
                <div className="text-xs text-slate-600 mt-0.5">
                  {totalMovil > 0 ? Math.round((viewtvMovil / totalMovil) * 100) : 0}% del total Móvil
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Resumen global */}
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6">
          <h3 className="text-slate-300 font-semibold text-sm uppercase tracking-wider mb-5">Resumen de uso de licencias</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-900/60 border border-slate-700 rounded-xl p-5 text-center">
              <div className="text-slate-400 text-xs mb-2 uppercase tracking-wide">Licencias totales</div>
              <div className="text-3xl font-bold text-indigo-400 font-mono">{totalLicencias.toLocaleString()}</div>
            </div>
            <div className="bg-slate-900/60 border border-slate-700 rounded-xl p-5 text-center">
              <div className="text-slate-400 text-xs mb-2 uppercase tracking-wide">Uso STB + Móvil combinados</div>
              <div className={`text-3xl font-bold font-mono ${globalColors.text}`}>
                {(totalStb + totalMovil).toLocaleString()}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                {totalLicencias > 0 ? (((totalStb + totalMovil) / totalLicencias) * 100).toFixed(1) : 0}% del límite
              </div>
            </div>
            <div className="bg-slate-900/60 border border-slate-700 rounded-xl p-5 text-center">
              <div className="text-slate-400 text-xs mb-2 uppercase tracking-wide">Nivel de saturación</div>
              <span className={`text-sm px-3 py-1.5 rounded-full font-semibold ${globalColors.badge}`}>
                {globalColors.label} — {maxPct.toFixed(1)}%
              </span>
              <div className="text-xs text-slate-500 mt-2">
                Basado en el mayor uso (STB o Móvil)
              </div>
            </div>
          </div>

          {/* Leyenda de colores */}
          <div className="mt-5 flex flex-wrap gap-3 text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" />
              Verde — menos del 60% (margen seguro)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-amber-400 inline-block" />
              Amarillo — 60% a 85% (atención)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-red-500 inline-block" />
              Rojo — más del 85% (crítico / superado)
            </span>
          </div>
        </div>

      </div>
    </div>
  );
}
