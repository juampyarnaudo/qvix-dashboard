import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/app/lib/db";
import { getSession } from "@/app/lib/session";

const SUCURSALES: Record<number, string> = {
  1: "Chumbicha",
  4: "Valle Viejo",
  5: "Tinogasta",
  6: "Rodeo",
  7: "La Puerta",
  8: "Fiambalá",
};

interface ConexionExistente {
  id_conexion: number;
  nombre: string;
  documento: string;
  sucursal: string;
  estado: string;
  direccion: string;
  calle: string | null;
  numero: string | null;
  telefono: string | null;
  fecha_alta: string | null;
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const documento = (req.nextUrl.searchParams.get("documento") ?? "").replace(/\D/g, "");
  if (!documento) return NextResponse.json({ error: "Documento inválido" }, { status: 400 });

  const { sucursales: sucursalesPermitidas } = session.user;

  try {
    const pool = await getPool();
    const result = await pool.request()
      .input("documento", documento)
      .query(`
        SELECT
          vcd2.id_conexion,
          vcd2.apellido_nombre,
          vcd2.documento_numero,
          vcd2.nom_calle,
          vcd2.dom_numero,
          vcd2.nom_barrio,
          vcd2.telefono,
          vcd2.celular,
          vcd.Estado_Servicio,
          vcd.cod_sucursal,
          ts.descripcion AS estado_nombre,
          c.fecha_alta,
          c.fecha_conexion
        FROM v_conexiones_domicilio vcd2
        LEFT JOIN v_con_dom vcd           ON vcd.id_conexion = vcd2.id_conexion
        LEFT JOIN tipo_estado_servicio ts ON ts.id_estado_servicio = vcd.Estado_Servicio
        LEFT JOIN Conexiones c            ON c.id_conexion = vcd2.id_conexion
        WHERE REPLACE(REPLACE(vcd2.documento_numero, '.', ''), ' ', '') = @documento
        ORDER BY vcd.Estado_Servicio ASC
      `);

    const conexiones: ConexionExistente[] = (result.recordset as Record<string, unknown>[])
      .filter((r) => sucursalesPermitidas === null || sucursalesPermitidas.includes(Number(r.cod_sucursal)))
      .map((r) => ({
        id_conexion: Number(r.id_conexion),
        nombre: String(r.apellido_nombre ?? ""),
        documento: String(r.documento_numero ?? ""),
        sucursal: SUCURSALES[Number(r.cod_sucursal)] ?? String(r.cod_sucursal ?? "—"),
        estado: String(r.estado_nombre ?? "—"),
        direccion: [r.nom_calle, r.dom_numero].filter(Boolean).join(" ") + (r.nom_barrio ? ` (${r.nom_barrio})` : ""),
        calle: (r.nom_calle as string | null) ?? null,
        numero: (r.dom_numero as string | null) ?? null,
        telefono: (r.celular || r.telefono) as string | null,
        fecha_alta: ((r.fecha_alta ?? r.fecha_conexion) as Date | null)?.toISOString() ?? null,
      }));

    return NextResponse.json({ conexiones });
  } catch (err: unknown) {
    console.error("[solicitudes-conexion/buscar-dni]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
