"use client";
import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import { Upload, AlertCircle, X, Unlock, CheckCircle2, XCircle, Loader2, Download } from "lucide-react";
import ConfirmModal from "./ConfirmModal";

const COLUMNAS_SERIAL = new Set(["snserial", "serial", "mtamac"]);
const BATCH_SIZE = 10;

interface Resultado {
  snserial: string;
  resultado: "OK" | "FALLO" | "ERROR";
  returncode: string | null;
  errormsg: string | null;
  fecha: string;
}

function normalizarTitulo(v: unknown): string {
  return String(v ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

export default function ZteDesbloqueoView({ onClose }: { onClose: () => void }) {
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [filasDatos, setFilasDatos] = useState<unknown[][]>([]);
  const [seriales, setSeriales] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [mostrarConfirmacion, setMostrarConfirmacion] = useState(false);
  const [procesando, setProcesando] = useState(false);
  const [resultados, setResultados] = useState<Resultado[]>([]);
  const [detenido, setDetenido] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const extraerSeriales = (filas: unknown[][], colIndex: number) => {
    const vistos = new Set<string>();
    const lista: string[] = [];
    for (const fila of filas) {
      const valor = fila?.[colIndex];
      if (valor === null || valor === undefined) continue;
      const s = String(valor).trim();
      if (s && !vistos.has(s)) {
        vistos.add(s);
        lista.push(s);
      }
    }
    setSeriales(lista);
    setError(lista.length === 0 ? "No encontré valores en esa columna." : "");
  };

  const leerArchivo = (file: File) => {
    setError("");
    setResultados([]);
    setDetenido(false);
    setSeriales([]);
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const filas = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null }) as unknown[][];

        if (filas.length === 0) {
          setError("El archivo está vacío.");
          return;
        }

        const titulos = filas[0];
        setHeaders(titulos.map((t) => String(t ?? "")));
        setFilasDatos(filas.slice(1));

        const indices = titulos
          .map((t, i) => ({ t, i }))
          .filter(({ t }) => COLUMNAS_SERIAL.has(normalizarTitulo(t)));

        if (indices.length === 1) {
          extraerSeriales(filas.slice(1), indices[0].i);
        } else {
          setError(
            indices.length === 0
              ? "No encontré una columna de serial (snserial / serial / mtamac). Elegí la columna manualmente abajo."
              : "Hay más de una columna posible. Elegí cuál usar abajo."
          );
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

  const ejecutar = async () => {
    setMostrarConfirmacion(false);
    setProcesando(true);
    setResultados([]);
    setDetenido(false);
    setError("");

    for (let i = 0; i < seriales.length; i += BATCH_SIZE) {
      const lote = seriales.slice(i, i + BATCH_SIZE);
      try {
        const res = await fetch("/api/dispositivos/zte-desbloqueo", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ seriales: lote }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? "Error desbloqueando el lote.");
          break;
        }
        setResultados((prev) => [...prev, ...data.resultados]);
        if (data.detenido) {
          setDetenido(true);
          break;
        }
      } catch {
        setError("Error de red al desbloquear. Los decos ya procesados quedan desbloqueados.");
        break;
      }
    }
    setProcesando(false);
  };

  const descargarResultado = () => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(resultados);
    XLSX.utils.book_append_sheet(wb, ws, "Resultado");
    const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
    const blob = new Blob([buf], { type: "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `zte-desbloqueo-resultado-${new Date().toISOString().slice(0, 19).replace(/[-:T]/g, "")}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const sinZbox = seriales.filter((s) => !s.toUpperCase().includes("ZBOX"));
  const resumen = resultados.reduce(
    (acc, r) => ({ ...acc, [r.resultado]: (acc[r.resultado] ?? 0) + 1 }),
    {} as Record<string, number>
  );
  const terminado = !procesando && resultados.length > 0;

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <div className="max-w-screen-xl mx-auto px-6 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-100">Desbloqueo de decos ZTE</h2>
            <p className="text-sm text-slate-400 mt-0.5">
              Subí un Excel con los seriales (snserial) a desbloquear en SMP
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 text-slate-400 hover:text-slate-200 border border-slate-700 hover:border-slate-500 px-3 py-1.5 rounded-lg text-sm transition-colors"
          >
            <X size={15} /> Volver al dashboard
          </button>
        </div>

        {!procesando && resultados.length === 0 && (
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
            <p className="text-xs text-slate-600 mt-1">Listado de seriales a desbloquear (.xlsx / .xls)</p>
            <input ref={inputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFile} />
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 text-red-400 bg-red-950/30 border border-red-800 rounded-lg px-4 py-3 text-sm">
            <AlertCircle size={16} /> {error}
          </div>
        )}

        {headers.length > 0 && seriales.length === 0 && !procesando && (
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
            <p className="text-sm font-medium text-slate-300 mb-3">Elegí la columna con el serial</p>
            <select
              onChange={(e) => e.target.value !== "" && extraerSeriales(filasDatos, Number(e.target.value))}
              defaultValue=""
              className="w-full max-w-sm bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
            >
              <option value="">— seleccionar —</option>
              {headers.map((h, i) => (
                <option key={i} value={i}>{h || `Columna ${i + 1}`}</option>
              ))}
            </select>
          </div>
        )}

        {seriales.length > 0 && resultados.length === 0 && !procesando && (
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 space-y-3">
            <p className="text-slate-200">
              Se encontraron <span className="font-bold text-indigo-400">{seriales.length}</span> seriales para desbloquear.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {seriales.slice(0, 10).map((s) => (
                <span key={s} className="font-mono text-xs bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-300">
                  {s}
                </span>
              ))}
              {seriales.length > 10 && (
                <span className="text-xs text-slate-500 px-2 py-1">... y {seriales.length - 10} más</span>
              )}
            </div>
            {sinZbox.length > 0 && (
              <div className="flex items-center gap-2 text-amber-400 bg-amber-950/30 border border-amber-800 rounded-lg px-4 py-2.5 text-sm">
                <AlertCircle size={15} className="flex-shrink-0" />
                {sinZbox.length} serial{sinZbox.length > 1 ? "es" : ""} no contiene{sinZbox.length > 1 ? "n" : ""} &quot;ZBOX&quot; (ej. {sinZbox[0]}). Verificá que estén bien antes de continuar.
              </div>
            )}
            <button
              onClick={() => setMostrarConfirmacion(true)}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors"
            >
              <Unlock size={15} /> Desbloquear {seriales.length} decos
            </button>
          </div>
        )}

        {procesando && (
          <div className="flex items-center gap-3 bg-slate-800 border border-slate-700 rounded-xl p-5 text-slate-300">
            <Loader2 size={18} className="animate-spin text-indigo-400" />
            Procesando... {resultados.length} / {seriales.length}
          </div>
        )}

        {detenido && (
          <div className="flex items-center gap-2 text-red-400 bg-red-950/30 border border-red-800 rounded-lg px-4 py-3 text-sm">
            <AlertCircle size={16} /> Se detuvo la corrida por errores seguidos de conexión con SMP. Revisá el detalle y reintentá con el resto del listado.
          </div>
        )}

        {resultados.length > 0 && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 text-center">
                <div className="flex items-center justify-center gap-1.5 text-emerald-400 text-xs mb-1">
                  <CheckCircle2 size={13} /> OK
                </div>
                <div className="text-3xl font-bold text-emerald-400">{resumen.OK ?? 0}</div>
              </div>
              <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 text-center">
                <div className="flex items-center justify-center gap-1.5 text-amber-400 text-xs mb-1">
                  <AlertCircle size={13} /> FALLO
                </div>
                <div className="text-3xl font-bold text-amber-400">{resumen.FALLO ?? 0}</div>
              </div>
              <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 text-center">
                <div className="flex items-center justify-center gap-1.5 text-red-400 text-xs mb-1">
                  <XCircle size={13} /> ERROR
                </div>
                <div className="text-3xl font-bold text-red-400">{resumen.ERROR ?? 0}</div>
              </div>
            </div>

            <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
                <h3 className="text-slate-200 font-semibold">Detalle</h3>
                {terminado && (
                  <button
                    onClick={descargarResultado}
                    className="flex items-center gap-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
                  >
                    <Download size={13} /> Descargar resultado
                  </button>
                )}
              </div>
              <div className="overflow-x-auto max-h-[28rem] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-slate-800">
                    <tr className="border-b border-slate-700 text-xs text-slate-500 uppercase tracking-wider">
                      <th className="py-3 px-5 text-left">Serial</th>
                      <th className="py-3 px-5 text-left">Resultado</th>
                      <th className="py-3 px-5 text-left">Detalle</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resultados.map((r, i) => (
                      <tr key={`${r.snserial}-${i}`} className="border-b border-slate-700/50">
                        <td className="py-2.5 px-5 font-mono text-slate-200">{r.snserial}</td>
                        <td className="py-2.5 px-5">
                          <span
                            className={`text-xs font-medium px-2 py-0.5 rounded-full border ${
                              r.resultado === "OK"
                                ? "bg-emerald-900/40 text-emerald-400 border-emerald-800"
                                : r.resultado === "FALLO"
                                ? "bg-amber-900/40 text-amber-400 border-amber-800"
                                : "bg-red-900/40 text-red-400 border-red-800"
                            }`}
                          >
                            {r.resultado}
                          </span>
                        </td>
                        <td className="py-2.5 px-5 text-slate-500 text-xs">{r.errormsg ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {mostrarConfirmacion && (
          <ConfirmModal
            message={`Se van a desbloquear ${seriales.length} decos en SMP. Esta acción afecta equipos reales de clientes. ¿Confirmás?`}
            confirmLabel="Desbloquear"
            onConfirm={ejecutar}
            onCancel={() => setMostrarConfirmacion(false)}
          />
        )}
      </div>
    </div>
  );
}
