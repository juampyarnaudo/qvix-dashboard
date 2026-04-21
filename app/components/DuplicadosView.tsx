"use client";
import { useState, useRef } from "react";
import * as XLSX from "xlsx";
import { Upload, AlertCircle, Users, ChevronDown, ChevronUp, X } from "lucide-react";

interface RawRow {
  [key: string]: string | number | null | undefined;
}

interface UsuarioDuplicado {
  id: string;
  planes: string[];
  cantidad: number;
  organizacion?: string;
}

interface Resultado {
  total: number;
  usuarios: UsuarioDuplicado[];
  colId: string;
  colPlan: string;
  colOrg?: string;
}

function detectarColumna(headers: string[], candidatos: string[]): string | undefined {
  return headers.find((h) =>
    candidatos.some((c) => h.toLowerCase().includes(c.toLowerCase()))
  );
}

export default function DuplicadosView({ onClose }: { onClose: () => void }) {
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [error, setError] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<RawRow[]>([]);
  const [colId, setColId] = useState("");
  const [colPlan, setColPlan] = useState("");
  const [colOrg, setColOrg] = useState("");
  const [fileName, setFileName] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const procesarDatos = (rows: RawRow[], cId: string, cPlan: string, cOrg: string) => {
    if (!cId || !cPlan) {
      setError("Seleccioná la columna de ID y la columna de Plan.");
      return;
    }

    // Agrupar por ID → listar todos los planes básicos
    const mapa = new Map<string, { planes: string[]; org?: string }>();

    for (const row of rows) {
      const id = String(row[cId] ?? "").trim();
      const plan = String(row[cPlan] ?? "").trim();
      const org = cOrg ? String(row[cOrg] ?? "").trim() : undefined;

      if (!id || !plan) continue;

      // Solo contar planes que contengan "basico" o "básico" (case insensitive)
      const esBasico = /b[aá]sico/i.test(plan);
      if (!esBasico) continue;

      if (!mapa.has(id)) {
        mapa.set(id, { planes: [], org });
      }
      mapa.get(id)!.planes.push(plan);
    }

    // Filtrar los que tienen 2 o más planes básicos
    const duplicados: UsuarioDuplicado[] = [];
    for (const [id, data] of mapa.entries()) {
      if (data.planes.length >= 2) {
        duplicados.push({
          id,
          planes: data.planes,
          cantidad: data.planes.length,
          organizacion: data.org,
        });
      }
    }

    // Ordenar por cantidad desc
    duplicados.sort((a, b) => b.cantidad - a.cantidad);

    setResultado({
      total: duplicados.length,
      usuarios: duplicados,
      colId: cId,
      colPlan: cPlan,
      colOrg: cOrg || undefined,
    });
    setError("");
  };

  const leerArchivo = (file: File) => {
    setError("");
    setResultado(null);
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows: RawRow[] = XLSX.utils.sheet_to_json(ws, { defval: "" });

        if (rows.length === 0) {
          setError("El archivo está vacío o no tiene datos válidos.");
          return;
        }

        const cols = Object.keys(rows[0]);
        setHeaders(cols);
        setRawRows(rows);

        // Auto-detección de columnas
        const autoId = detectarColumna(cols, ["id usuario", "id_usuario", "usuario_id", "id_abonado", "abonado", "cliente_id", "id cliente", "id"]) ?? "";
        const autoPlan = detectarColumna(cols, ["plan", "servicio", "producto", "descripcion", "nombre plan"]) ?? "";
        const autoOrg = detectarColumna(cols, ["organización", "organizacion", "org", "empresa", "operadora"]) ?? "";

        setColId(autoId);
        setColPlan(autoPlan);
        setColOrg(autoOrg);

        if (autoId && autoPlan) {
          procesarDatos(rows, autoId, autoPlan, autoOrg);
        }
      } catch {
        setError("No se pudo leer el archivo. Verificá que sea un .xlsx o .xls válido.");
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) leerArchivo(file);
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) leerArchivo(file);
  };

  const usuariosFiltrados = resultado
    ? busqueda
      ? resultado.usuarios.filter(
          (u) =>
            u.id.toLowerCase().includes(busqueda.toLowerCase()) ||
            u.organizacion?.toLowerCase().includes(busqueda.toLowerCase())
        )
      : resultado.usuarios
    : [];

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <div className="max-w-screen-xl mx-auto px-6 py-8 space-y-6">

        {/* Título */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-100">Control de Duplicados — Planes Básicos</h2>
            <p className="text-sm text-slate-400 mt-0.5">
              Usuarios con 2 o más planes básicos activos
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 text-slate-400 hover:text-slate-200 border border-slate-700 hover:border-slate-500 px-3 py-1.5 rounded-lg text-sm transition-colors"
          >
            <X size={15} /> Volver al dashboard
          </button>
        </div>

        {/* Upload */}
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => inputRef.current?.click()}
          className="border-2 border-dashed border-slate-600 hover:border-indigo-500 rounded-xl p-10 text-center cursor-pointer transition-colors"
        >
          <Upload size={32} className="mx-auto mb-3 text-slate-500" />
          {fileName ? (
            <p className="text-slate-200 font-medium">{fileName}</p>
          ) : (
            <p className="text-slate-400">
              Arrastrá el archivo acá o <span className="text-indigo-400 font-medium">hacé click para seleccionarlo</span>
            </p>
          )}
          <p className="text-xs text-slate-600 mt-1">Reporte de usuarios y dispositivos (.xlsx / .xls)</p>
          <input ref={inputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFile} />
        </div>

        {/* Selector de columnas (si hay headers pero no resultado o quiere reconfigurar) */}
        {headers.length > 0 && (
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
            <p className="text-sm font-medium text-slate-300 mb-4">Configuración de columnas</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { label: "Columna ID Usuario *", value: colId, setter: setColId },
                { label: "Columna Plan *", value: colPlan, setter: setColPlan },
                { label: "Columna Organización (opcional)", value: colOrg, setter: setColOrg },
              ].map(({ label, value, setter }) => (
                <div key={label}>
                  <label className="text-xs text-slate-400 block mb-1">{label}</label>
                  <select
                    value={value}
                    onChange={(e) => setter(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="">— seleccionar —</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            <button
              onClick={() => procesarDatos(rawRows, colId, colPlan, colOrg)}
              className="mt-4 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors"
            >
              Analizar
            </button>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 text-red-400 bg-red-950/30 border border-red-800 rounded-lg px-4 py-3 text-sm">
            <AlertCircle size={16} /> {error}
          </div>
        )}

        {/* Resultados */}
        {resultado && (
          <div className="space-y-5">
            {/* Resumen */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 text-center">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Users size={18} className="text-red-400" />
                  <span className="text-slate-400 text-sm">Usuarios con plan básico duplicado</span>
                </div>
                <div className="text-4xl font-bold text-red-400">{resultado.total.toLocaleString()}</div>
              </div>
              <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 text-center">
                <div className="text-slate-400 text-sm mb-2">Total registros analizados</div>
                <div className="text-4xl font-bold text-slate-200">{rawRows.length.toLocaleString()}</div>
              </div>
              <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 text-center">
                <div className="text-slate-400 text-sm mb-2">Planes básicos duplicados totales</div>
                <div className="text-4xl font-bold text-amber-400">
                  {resultado.usuarios.reduce((s, u) => s + u.cantidad, 0).toLocaleString()}
                </div>
              </div>
            </div>

            {/* Tabla */}
            <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
                <h3 className="text-slate-200 font-semibold">
                  Detalle de usuarios duplicados
                </h3>
                <input
                  type="text"
                  placeholder="Buscar por ID u organización..."
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  className="bg-slate-900 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 w-64"
                />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-700 text-xs text-slate-500 uppercase tracking-wider">
                      <th className="py-3 px-5 text-left">ID Usuario</th>
                      {resultado.colOrg && <th className="py-3 px-5 text-left">Organización</th>}
                      <th className="py-3 px-5 text-center">Cant. básicos</th>
                      <th className="py-3 px-5 text-left">Planes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usuariosFiltrados.map((u) => (
                      <>
                        <tr
                          key={u.id}
                          className="border-b border-slate-700/50 hover:bg-slate-700/20 cursor-pointer"
                          onClick={() => setExpandedId(expandedId === u.id ? null : u.id)}
                        >
                          <td className="py-3 px-5 font-mono text-slate-200 font-medium">{u.id}</td>
                          {resultado.colOrg && (
                            <td className="py-3 px-5 text-slate-300">{u.organizacion || "—"}</td>
                          )}
                          <td className="py-3 px-5 text-center">
                            <span className="bg-red-900/40 text-red-400 border border-red-800 text-xs font-mono px-2 py-0.5 rounded-full">
                              {u.cantidad}
                            </span>
                          </td>
                          <td className="py-3 px-5 text-slate-400 text-xs">
                            <div className="flex items-center gap-2">
                              <span className="truncate max-w-xs">{u.planes[0]}</span>
                              {u.planes.length > 1 && (
                                <span className="text-slate-600 flex items-center gap-0.5">
                                  +{u.planes.length - 1} más
                                  {expandedId === u.id ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                        {expandedId === u.id && (
                          <tr key={`${u.id}-exp`} className="bg-slate-900/40 border-b border-slate-700/50">
                            <td colSpan={resultado.colOrg ? 4 : 3} className="px-5 py-3">
                              <ul className="space-y-1">
                                {u.planes.map((p, i) => (
                                  <li key={i} className="text-xs text-slate-300 flex items-center gap-2">
                                    <span className="w-4 h-4 rounded-full bg-red-900/40 border border-red-800 text-red-400 text-[10px] flex items-center justify-center font-bold">
                                      {i + 1}
                                    </span>
                                    {p}
                                  </li>
                                ))}
                              </ul>
                            </td>
                          </tr>
                        )}
                      </>
                    ))}
                    {usuariosFiltrados.length === 0 && (
                      <tr>
                        <td colSpan={4} className="py-12 text-center text-slate-600">
                          {busqueda ? "Sin resultados para esa búsqueda." : "No se encontraron duplicados con los filtros actuales."}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              {usuariosFiltrados.length > 0 && (
                <div className="px-5 py-3 border-t border-slate-700 text-xs text-slate-500">
                  Mostrando {usuariosFiltrados.length} de {resultado.total} usuarios
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
