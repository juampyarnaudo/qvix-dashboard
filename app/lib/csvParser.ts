import Papa from "papaparse";
import type { DataRow, Servicio } from "./types";

// Formato CSV:
// servicio,organizacion,fecha,stb,movil
// GOTV,VV,2026-01-07,2445,210
// ViewTV,La Rioja,2025-10-22,14125,1447
export function parseCSV(text: string): DataRow[] {
  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase(),
  });

  return result.data
    .filter((row) => row.organizacion && row.fecha && row.stb !== undefined)
    .map((row) => ({
      servicio: (row.servicio?.trim() || "GOTV") as Servicio,
      organizacion: row.organizacion.trim(),
      fecha: normalizeDate(row.fecha.trim()),
      stb: parseInt(row.stb) || 0,
      movil: parseInt(row.movil) || 0,
    }));
}

function normalizeDate(raw: string): string {
  if (/^\d{2}-\d{2}-\d{4}$/.test(raw)) {
    const [d, m, y] = raw.split("-");
    return `${y}-${m}-${d}`;
  }
  return raw;
}
