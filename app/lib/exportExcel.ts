import * as XLSX from "xlsx";
import type { DataRow, OrgStats } from "./types";
import { buildTotales } from "./dataUtils";

export function exportToExcel(rows: DataRow[], orgStats: OrgStats[], servicio: string) {
  const wb = XLSX.utils.book_new();

  // Hoja 1: Datos crudos
  const rawData = rows.map((r) => ({
    Organización: r.organizacion,
    Fecha: r.fecha,
    STB: r.stb,
    Móvil: r.movil,
    Total: r.stb + r.movil,
  }));
  const ws1 = XLSX.utils.json_to_sheet(rawData);
  XLSX.utils.book_append_sheet(wb, ws1, "Datos");

  // Hoja 2: Evolución por org con diferencias %
  const evolucion: Record<string, string | number>[] = [];
  for (const org of orgStats) {
    for (const d of org.datos) {
      evolucion.push({
        Organización: org.organizacion,
        Fecha: d.fecha,
        STB: d.stb,
        "STB Var%": d.stbDiff !== undefined ? `${d.stbDiff}%` : "-",
        Móvil: d.movil,
        "Móvil Var%": d.movilDiff !== undefined ? `${d.movilDiff}%` : "-",
      });
    }
  }
  const ws2 = XLSX.utils.json_to_sheet(evolucion);
  XLSX.utils.book_append_sheet(wb, ws2, "Evolución");

  // Hoja 3: Totales por fecha
  const totales = buildTotales(rows).map((t) => ({
    Fecha: t.fecha,
    "Total STB": t.stb,
    "Total Móvil": t.movil,
    "Total Usuarios": t.stb + t.movil,
  }));
  const ws3 = XLSX.utils.json_to_sheet(totales);
  XLSX.utils.book_append_sheet(wb, ws3, "Totales");

  XLSX.writeFile(wb, `${servicio}_Informe_${new Date().toISOString().slice(0, 10)}.xlsx`);
}
