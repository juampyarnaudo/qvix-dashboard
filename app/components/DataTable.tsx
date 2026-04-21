"use client";
import { Fragment, useState } from "react";
import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import type { DataRow } from "../lib/types";

interface Props {
  rows: DataRow[];
  onEdit?: (row: DataRow) => void;
  onDelete?: (row: DataRow) => void;
}

type SortKey = "organizacion" | string; // organizacion o fecha_stb / fecha_movil
type SortDir = "asc" | "desc";

const SortIcon = ({ col, sort }: { col: string; sort: { key: SortKey; dir: SortDir } | null }) => {
  if (!sort || sort.key !== col) return <ChevronsUpDown size={12} className="opacity-30" />;
  return sort.dir === "asc" ? <ChevronUp size={12} /> : <ChevronDown size={12} />;
};

export default function DataTable({ rows, onEdit, onDelete }: Props) {
  const fechas = [...new Set(rows.map((r) => r.fecha))].sort(
    (a, b) => new Date(a).getTime() - new Date(b).getTime()
  );
  const orgs = [...new Set(rows.map((r) => r.organizacion))];

  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir } | null>(null);

  const get = (org: string, fecha: string, tipo: "stb" | "movil") =>
    rows.find((r) => r.organizacion === org && r.fecha === fecha)?.[tipo] ?? 0;

  const toggleSort = (key: SortKey) => {
    setSort((prev) =>
      prev?.key === key
        ? prev.dir === "asc" ? { key, dir: "desc" } : null
        : { key, dir: "asc" }
    );
  };

  const sortedOrgs = [...orgs].sort((a, b) => {
    if (!sort) return 0;
    if (sort.key === "organizacion") {
      return sort.dir === "asc" ? a.localeCompare(b) : b.localeCompare(a);
    }
    // key = "fecha|tipo"
    const [fecha, tipo] = sort.key.split("|") as [string, "stb" | "movil"];
    const va = get(a, fecha, tipo);
    const vb = get(b, fecha, tipo);
    return sort.dir === "asc" ? va - vb : vb - va;
  });

  const thClass = "px-3 py-2 text-center text-slate-400 text-xs cursor-pointer select-none hover:text-slate-200 transition-colors";

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 overflow-x-auto">
      <h3 className="text-slate-200 font-semibold mb-4">Datos por organización</h3>
      <table className="w-full text-sm text-slate-300">
        <thead>
          <tr className="border-b border-slate-700">
            <th
              className="px-3 py-2 text-left text-slate-400 text-xs cursor-pointer select-none hover:text-slate-200 transition-colors"
              onClick={() => toggleSort("organizacion")}
            >
              <span className="flex items-center gap-1">
                Organización <SortIcon col="organizacion" sort={sort} />
              </span>
            </th>
            {fechas.map((f) => (
              <th key={f} colSpan={2} className="px-3 py-2 text-center text-slate-400 text-xs">
                {f}
              </th>
            ))}
          </tr>
          <tr className="border-b border-slate-700">
            <th />
            {fechas.map((f) => (
              <Fragment key={f}>
                <th className={thClass} onClick={() => toggleSort(`${f}|stb`)}>
                  <span className="flex items-center justify-center gap-1">
                    STB <SortIcon col={`${f}|stb`} sort={sort} />
                  </span>
                </th>
                <th className={thClass} onClick={() => toggleSort(`${f}|movil`)}>
                  <span className="flex items-center justify-center gap-1">
                    Móvil <SortIcon col={`${f}|movil`} sort={sort} />
                  </span>
                </th>
              </Fragment>
            ))}
            {(onEdit || onDelete) && <th />}
          </tr>
        </thead>
        <tbody>
          {sortedOrgs.map((org) => (
            <tr key={org} className="border-b border-slate-700/50 hover:bg-slate-700/30">
              <td className="px-3 py-2 font-medium text-slate-200">{org}</td>
              {fechas.map((f) => (
                <Fragment key={f}>
                  <td className="px-3 py-2 text-center font-mono">{get(org, f, "stb") || "-"}</td>
                  <td className="px-3 py-2 text-center font-mono">{get(org, f, "movil") || "-"}</td>
                </Fragment>
              ))}
              {(onEdit || onDelete) && (
                <td className="px-3 py-2 text-center">
                  <div className="flex gap-2 justify-center">
                    {onEdit && (
                      <button
                        onClick={() => {
                          const lastFecha = fechas.at(-1)!;
                          const r = rows.find((r) => r.organizacion === org && r.fecha === lastFecha);
                          if (r) onEdit(r);
                        }}
                        className="text-xs text-indigo-400 hover:text-indigo-300"
                      >
                        Editar
                      </button>
                    )}
                    {onDelete && (
                      <button
                        onClick={() => {
                          const lastFecha = fechas.at(-1)!;
                          const r = rows.find((r) => r.organizacion === org && r.fecha === lastFecha);
                          if (r) onDelete(r);
                        }}
                        className="text-xs text-red-400 hover:text-red-300"
                      >
                        Eliminar
                      </button>
                    )}
                  </div>
                </td>
              )}
            </tr>
          ))}
          {/* Fila totales */}
          <tr className="border-t-2 border-slate-600 bg-slate-700/30 font-semibold text-slate-100">
            <td className="px-3 py-2">TOTAL</td>
            {fechas.map((f) => {
              const stbTotal = rows.filter((r) => r.fecha === f).reduce((s, r) => s + r.stb, 0);
              const movilTotal = rows.filter((r) => r.fecha === f).reduce((s, r) => s + r.movil, 0);
              return (
                <Fragment key={f}>
                  <td className="px-3 py-2 text-center font-mono">{stbTotal}</td>
                  <td className="px-3 py-2 text-center font-mono">{movilTotal}</td>
                </Fragment>
              );
            })}
            {(onEdit || onDelete) && <td />}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
