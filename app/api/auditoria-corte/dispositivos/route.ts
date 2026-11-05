import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/app/lib/db";
import { getSession } from "@/app/lib/session";

export interface DispositivoConexion {
  nombre_dispositivo: string;
  mac: string | null;
  tipo: "ONT" | "IPTV" | "OTT" | "ANTENA" | "Otro";
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const idParam = req.nextUrl.searchParams.get("id_conexion");
  const idConexion = idParam ? parseInt(idParam, 10) : null;
  if (!idConexion) return NextResponse.json({ error: "id_conexion inválido" }, { status: 400 });

  try {
    const pool = await getPool();
    const result = await pool.request().input("id_conexion", idConexion).query(`
      SELECT
        d.nombre_dispositivo,
        cd.mac,
        CASE
          WHEN d.tipo_dispositivo = 'B' THEN 'ONT'
          WHEN d.tipo_dispositivo IN ('T','M') AND d.tipo_cuenta_usuario = 'CUBIWARE' THEN 'IPTV'
          WHEN d.tipo_dispositivo IN ('T','M') AND d.tipo_cuenta_usuario = 'QVIX' THEN 'OTT'
          WHEN d.tipo_dispositivo = 'W' THEN 'ANTENA'
          ELSE 'Otro'
        END AS tipo
      FROM conexion_dispostivos cd
      JOIN DISPOSITIVOS d ON d.id_dispositivo = cd.id_dispositivo
      WHERE cd.id_conexion = @id_conexion AND cd.estado = 0
      ORDER BY d.nombre_dispositivo
    `);

    return NextResponse.json({ dispositivos: result.recordset as DispositivoConexion[] });
  } catch (err: unknown) {
    console.error("[auditoria-corte/dispositivos]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
