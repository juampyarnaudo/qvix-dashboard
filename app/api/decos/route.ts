import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/app/lib/db";

const ALL_SUCURSALES = "4,1,5,6,7,8";

function buildIn(raw: string | null, fallback: string): string {
  if (!raw) return fallback;
  const parsed = raw
    .split(",")
    .map((v) => parseInt(v.trim(), 10))
    .filter((n) => !isNaN(n) && n > 0 && n < 10000);
  return parsed.length > 0 ? parsed.join(",") : fallback;
}

export async function GET(req: NextRequest) {
  const estadosIn  = buildIn(req.nextUrl.searchParams.get("estados"), "3,6");
  const sucursalesIn = buildIn(req.nextUrl.searchParams.get("sucursal"), ALL_SUCURSALES);

  const query = `
    SELECT
      d.nombre_dispositivo AS dispositivo,
      d.tipo_cuenta_usuario AS tipo,
      COUNT(*) AS cantidad
    FROM v_con_dom vcd
    JOIN conexion_dispostivos cd ON vcd.id_conexion = cd.id_conexion
    JOIN DISPOSITIVOS d ON d.id_dispositivo = cd.id_dispositivo
    WHERE cd.estado = 0
      AND vcd.Estado_Servicio IN (${estadosIn})
      AND vcd.cod_sucursal IN (${sucursalesIn})
      AND (d.tipo_dispositivo = 'T' OR d.tipo_dispositivo = 'M')
      AND d.tipo_cuenta_usuario IN ('CUBIWARE', 'QVIX')
    GROUP BY d.nombre_dispositivo, d.tipo_cuenta_usuario
    ORDER BY d.tipo_cuenta_usuario, COUNT(*) DESC
  `;

  try {
    const pool = await getPool();
    const result = await pool.request().query(query);

    const iptv: { dispositivo: string; cantidad: number }[] = [];
    const ott:  { dispositivo: string; cantidad: number }[] = [];

    for (const row of result.recordset) {
      const item = { dispositivo: row.dispositivo, cantidad: Number(row.cantidad) };
      if (row.tipo === "CUBIWARE") iptv.push(item);
      else ott.push(item);
    }

    return NextResponse.json({ iptv, ott });
  } catch (err: unknown) {
    console.error("[decos]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
