import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { getPool } from "@/app/lib/db";
import { getSession } from "@/app/lib/session";
import { buildQuery, SUCURSALES, SUCURSALES_VALIDAS, type AuditoriaCorteRow } from "@/app/api/auditoria-corte/route";

const ESTADO_INCIDENCIA: Record<number, string> = { 1: "Pendiente", 2: "Asignada", 3: "Cerrada" };
const ESTADO_ODS: Record<number, string> = { 1: "Pendiente", 2: "Impresa", 4: "Cerrada" };

const COLOR_MAC = "FF2563EB"; // azul, para distinguir la MAC del nombre del dispositivo

function fmtMac(mac: string | null): string | null {
  if (!mac) return null;
  return mac.replace(/[:\-.\s]/g, "").toUpperCase().match(/.{1,2}/g)?.join(":") ?? mac;
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { sucursales: sucursalesPermitidas } = session.user;
  const sucursalParam = req.nextUrl.searchParams.get("sucursal");
  const sucursalN = sucursalParam ? parseInt(sucursalParam, 10) : null;
  if (sucursalN !== null && sucursalesPermitidas !== null && !sucursalesPermitidas.includes(sucursalN))
    return NextResponse.json({ error: "Sin acceso" }, { status: 403 });

  const sucursalesBase = sucursalesPermitidas ?? SUCURSALES_VALIDAS;
  const sucursalClause =
    sucursalN !== null && sucursalesBase.includes(sucursalN)
      ? `= ${sucursalN}`
      : `IN (${sucursalesBase.join(",") || "-1"})`;

  const filtroOds = req.nextUrl.searchParams.get("tieneOds"); // "si" | "no" | null (todos)

  try {
    const pool = await getPool();
    const result = await pool.request().query(buildQuery(sucursalClause));
    let recordset = result.recordset as AuditoriaCorteRow[];
    if (filtroOds === "si") recordset = recordset.filter((r) => r.id_orden_servicio !== null);
    if (filtroOds === "no") recordset = recordset.filter((r) => r.id_orden_servicio === null);

    const idsConexion = recordset.map((r) => r.id_conexion);
    const dispositivosPorConexion = new Map<number, { nombre_dispositivo: string; mac: string | null }[]>();
    if (idsConexion.length > 0) {
      const dispResult = await pool.request().query(`
        SELECT cd.id_conexion, d.nombre_dispositivo, cd.mac
        FROM conexion_dispostivos cd
        JOIN DISPOSITIVOS d ON d.id_dispositivo = cd.id_dispositivo
        WHERE cd.estado = 0 AND cd.id_conexion IN (${idsConexion.join(",")})
        ORDER BY cd.id_conexion, d.nombre_dispositivo
      `);
      for (const d of dispResult.recordset as { id_conexion: number; nombre_dispositivo: string; mac: string | null }[]) {
        const lista = dispositivosPorConexion.get(d.id_conexion) ?? [];
        lista.push(d);
        dispositivosPorConexion.set(d.id_conexion, lista);
      }
    }

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Auditoria Gestion de Corte");
    ws.columns = [
      { header: "ID_Conexion", key: "ID_Conexion", width: 12 },
      { header: "Sucursal", key: "Sucursal", width: 14 },
      { header: "Estado_Servicio", key: "Estado_Servicio", width: 28 },
      { header: "Tiene_ODS_Retiro", key: "Tiene_ODS_Retiro", width: 15 },
      { header: "N_ODS", key: "N_ODS", width: 10 },
      { header: "Estado_Incidencia", key: "Estado_Incidencia", width: 16 },
      { header: "Estado_ODS", key: "Estado_ODS", width: 12 },
      { header: "Fecha_Reclamo", key: "Fecha_Reclamo", width: 14 },
      { header: "Fecha_Asignacion", key: "Fecha_Asignacion", width: 14 },
      { header: "Fecha_Solucion", key: "Fecha_Solucion", width: 14 },
      { header: "Motivo", key: "Motivo", width: 24 },
      { header: "NAP_1er_Nivel", key: "NAP_1er_Nivel", width: 12 },
      { header: "NAP_2do_Nivel", key: "NAP_2do_Nivel", width: 12 },
      { header: "Dias", key: "Dias", width: 8 },
      { header: "Dias_Calculado_Desde", key: "Dias_Calculado_Desde", width: 26 },
      { header: "ONT", key: "ONT", width: 6 },
      { header: "IPTV", key: "IPTV", width: 6 },
      { header: "OTT", key: "OTT", width: 6 },
      { header: "Antena", key: "Antena", width: 8 },
      { header: "Total_Dispositivos", key: "Total_Dispositivos", width: 10 },
      { header: "Dispositivos_MAC", key: "Dispositivos_MAC", width: 70 },
    ];
    ws.getRow(1).font = { bold: true };

    for (const r of recordset) {
      const row = ws.addRow({
        ID_Conexion: r.id_conexion,
        Sucursal: SUCURSALES[r.cod_sucursal] ?? r.cod_sucursal,
        Estado_Servicio: r.estado_servicio,
        Tiene_ODS_Retiro: r.id_orden_servicio !== null ? "Sí" : "No",
        N_ODS: r.id_orden_servicio ?? "",
        Estado_Incidencia: r.estado_incidencia !== null ? (ESTADO_INCIDENCIA[r.estado_incidencia] ?? r.estado_incidencia) : "",
        Estado_ODS: r.estado_ods !== null ? (ESTADO_ODS[r.estado_ods] ?? r.estado_ods) : "",
        Fecha_Reclamo: r.fecha_reclamo ?? "",
        Fecha_Asignacion: r.fecha_asignacion ?? "",
        Fecha_Solucion: r.fecha_solucion ?? "",
        Motivo: r.motivo ?? "",
        NAP_1er_Nivel: r.nap_primer_nivel ?? "",
        NAP_2do_Nivel: r.nap_segundo_nivel ?? "",
        Dias: r.dias ?? "",
        Dias_Calculado_Desde: r.dias === null ? "" : r.dias_desde_vencimiento === 1 ? "Vto. última factura impaga" : "Fecha de reclamo",
        ONT: r.ont,
        IPTV: r.iptv,
        OTT: r.ott,
        Antena: r.antena,
        Total_Dispositivos: r.total_dispositivos,
      });

      // La MAC se pinta aparte (rich text) para distinguirla del nombre del dispositivo dentro
      // de la misma celda: la librería gratuita usada antes (xlsx/SheetJS) no soporta escribir
      // estilos, así que este endpoint pasó a exceljs.
      const dispositivos = dispositivosPorConexion.get(r.id_conexion) ?? [];
      const cell = row.getCell("Dispositivos_MAC");
      if (dispositivos.length > 0) {
        const richText: { text: string; font?: Partial<ExcelJS.Font> }[] = [];
        dispositivos.forEach((d, i) => {
          if (i > 0) richText.push({ text: " | " });
          const mac = fmtMac(d.mac);
          richText.push({ text: `${d.nombre_dispositivo} (` });
          richText.push({ text: mac ?? "sin MAC", font: { color: { argb: COLOR_MAC }, bold: true } });
          richText.push({ text: ")" });
        });
        cell.value = { richText };
      }
    }

    const buf = await wb.xlsx.writeBuffer();
    const nombreSucursal = sucursalN !== null ? (SUCURSALES[sucursalN] ?? sucursalN) : "Todas";
    const sufijo = filtroOds === "si" ? "-con-ods" : filtroOds === "no" ? "-sin-ods" : "";

    return new NextResponse(buf, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="auditoria-gestion-corte-${nombreSucursal}${sufijo}.xlsx"`,
      },
    });
  } catch (err: unknown) {
    console.error("[export/auditoria-corte]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
