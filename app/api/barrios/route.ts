import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/app/lib/db";

export async function GET(req: NextRequest) {
  const sucursal = req.nextUrl.searchParams.get("sucursal") ?? "4";
  const cod = parseInt(sucursal, 10);
  if (isNaN(cod)) return NextResponse.json([]);

  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT DISTINCT b.cod_barrio, b.nombre_barrio
      FROM v_con_dom vcd
      JOIN barrios b ON b.cod_barrio = vcd.cod_barrio
      WHERE vcd.cod_sucursal = ${cod}
        AND b.nombre_barrio IS NOT NULL
      ORDER BY b.nombre_barrio
    `);
    return NextResponse.json(result.recordset);
  } catch (err: unknown) {
    console.error("[barrios]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
