import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { DataRow, OrgStats, Servicio } from "./types";
import { buildTotales } from "./dataUtils";

export function exportToPDF(rows: DataRow[], orgStats: OrgStats[], servicio: Servicio) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const fecha = new Date().toLocaleDateString("es-AR");

  // Título
  doc.setFontSize(18);
  doc.setTextColor(40, 40, 40);
  doc.text(`${servicio} — Informe de usuarios`, 14, 18);

  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text(`Generado: ${fecha}`, 14, 25);

  // ── Tabla 1: Datos por organización ──────────────────────────────────────
  const fechas = [...new Set(rows.map((r) => r.fecha))].sort(
    (a, b) => new Date(a).getTime() - new Date(b).getTime()
  );
  const orgs = [...new Set(rows.map((r) => r.organizacion))];

  const head: string[][] = [
    ["Organización", ...fechas.flatMap((f) => [`STB ${f}`, `Móvil ${f}`])],
  ];
  const body: (string | number)[][] = orgs.map((org) => [
    org,
    ...fechas.flatMap((f) => {
      const row = rows.find((r) => r.organizacion === org && r.fecha === f);
      return [row?.stb ?? "-", row?.movil ?? "-"];
    }),
  ]);
  // Fila totales
  body.push([
    "TOTAL",
    ...fechas.flatMap((f) => {
      const fRows = rows.filter((r) => r.fecha === f);
      return [
        fRows.reduce((s, r) => s + r.stb, 0),
        fRows.reduce((s, r) => s + r.movil, 0),
      ];
    }),
  ]);

  autoTable(doc, {
    head,
    body,
    startY: 32,
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [79, 70, 229], textColor: 255 },
    footStyles: { fillColor: [240, 240, 240] },
    alternateRowStyles: { fillColor: [248, 248, 255] },
    didDrawCell: (data) => {
      // Negrita en fila TOTAL
      if (data.row.index === body.length - 1) {
        doc.setFont("helvetica", "bold");
      }
    },
  });

  // ── Tabla 2: Variación % ──────────────────────────────────────────────────
  const afterTable1 = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;

  doc.setFontSize(12);
  doc.setTextColor(40, 40, 40);
  doc.text("Variación % por período", 14, afterTable1);

  const diffHead = [["Organización", ...fechas.slice(1).flatMap((f) => [`STB Var% ${f}`, `Móvil Var% ${f}`])]];
  const diffBody = orgStats.map((o) => [
    o.organizacion,
    ...o.datos.slice(1).flatMap((d) => [
      d.stbDiff !== undefined ? `${d.stbDiff > 0 ? "+" : ""}${d.stbDiff}%` : "-",
      d.movilDiff !== undefined ? `${d.movilDiff > 0 ? "+" : ""}${d.movilDiff}%` : "-",
    ]),
  ]);

  autoTable(doc, {
    head: diffHead,
    body: diffBody,
    startY: afterTable1 + 4,
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [79, 70, 229], textColor: 255 },
    alternateRowStyles: { fillColor: [248, 248, 255] },
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index > 0) {
        const val = data.cell.raw as string;
        if (val.startsWith("+")) data.cell.styles.textColor = [22, 163, 74];
        else if (val.startsWith("-") && val !== "-") data.cell.styles.textColor = [220, 38, 38];
      }
    },
  });

  // ── Tabla 3: Totales ──────────────────────────────────────────────────────
  const afterTable2 = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;

  doc.setFontSize(12);
  doc.text("Totales por período", 14, afterTable2);

  const totales = buildTotales(rows);
  autoTable(doc, {
    head: [["Fecha", "Total STB", "Total Móvil", "Total Usuarios"]],
    body: totales.map((t) => [t.fecha, t.stb, t.movil, t.stb + t.movil]),
    startY: afterTable2 + 4,
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [79, 70, 229], textColor: 255 },
    alternateRowStyles: { fillColor: [248, 248, 255] },
  });

  doc.save(`${servicio}_Informe_${new Date().toISOString().slice(0, 10)}.pdf`);
}
