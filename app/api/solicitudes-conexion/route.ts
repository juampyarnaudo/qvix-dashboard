import { NextRequest, NextResponse } from "next/server";
import sql from "mssql";
import { getPool } from "@/app/lib/db";
import { getSession } from "@/app/lib/session";
import { ensureTable, TABLA, SUCURSALES, SUCURSALES_VALIDAS } from "@/app/api/solicitudes-conexion/public/route";

function validDate(s: string | null): string | null {
  return s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

export interface SolicitudRow {
  id: number;
  origen: string;
  vendedor_usuario: string | null;
  vendedor_nombre: string | null;
  cod_sucursal: number;
  fecha_solicitud: string;
  doble_play: boolean;
  velocidad: string | null;
  go_tv: boolean;
  inm_barrio: string | null;
  inm_localidad: string | null;
  inm_provincia: string | null;
  inm_calle: string | null;
  inm_numero: string | null;
  inm_piso: string | null;
  inm_dpto: string | null;
  inm_telefono: string | null;
  inm_lat: number | null;
  inm_lng: number | null;
  referencia: string | null;
  titular_apellido_nombre: string;
  titular_tipo_documento: string;
  titular_numero_documento: string;
  titular_barrio: string | null;
  titular_localidad: string | null;
  titular_provincia: string | null;
  titular_calle: string | null;
  titular_numero: string | null;
  titular_piso: string | null;
  titular_dpto: string | null;
  titular_telefono: string;
  titular_email: string | null;
  lugar_trabajo: string | null;
  ocupacion: string | null;
  ambito: string | null;
  precio: number | null;
  cliente_existente: boolean;
  instalada: boolean;
  instalada_id_conexion: number | null;
  instalada_usuario: string | null;
  instalada_fecha: string | null;
  no_corresponde: boolean;
  no_corresponde_motivo: string | null;
  no_corresponde_usuario: string | null;
  no_corresponde_fecha: string | null;
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
  const sucursalesConsulta = sucursalN !== null ? [sucursalN] : sucursalesBase;

  const desde = validDate(req.nextUrl.searchParams.get("desde"));
  const hasta = validDate(req.nextUrl.searchParams.get("hasta"));

  try {
    const pool = await getPool();
    await ensureTable(pool);

    const condiciones = [`cod_sucursal IN (${sucursalesConsulta.join(",") || "-1"})`];
    if (desde) condiciones.push(`fecha_solicitud >= '${desde}'`);
    if (hasta) condiciones.push(`fecha_solicitud < DATEADD(day, 1, '${hasta}')`);

    const result = await pool.request().query(`
      SELECT * FROM ${TABLA}
      WHERE ${condiciones.join(" AND ")}
      ORDER BY fecha_solicitud DESC
    `);
    const rows = result.recordset as SolicitudRow[];

    const total = rows.length;
    const porOrigen = { vendedor: rows.filter((r) => r.origen === "vendedor").length, qr: rows.filter((r) => r.origen === "qr").length };
    const conGoTv = rows.filter((r) => r.go_tv).length;

    const porSucursalMap = new Map<number, number>();
    for (const r of rows) porSucursalMap.set(r.cod_sucursal, (porSucursalMap.get(r.cod_sucursal) ?? 0) + 1);
    const porSucursal = [...porSucursalMap.entries()]
      .map(([cod, cantidad]) => ({ cod_sucursal: cod, nombre: SUCURSALES[cod] ?? `Suc. ${cod}`, cantidad }))
      .sort((a, b) => b.cantidad - a.cantidad);

    return NextResponse.json({
      total,
      porOrigen,
      conGoTv,
      porSucursal,
      rows: rows.slice(0, 500),
    });
  } catch (err: unknown) {
    console.error("[solicitudes-conexion GET]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

const ESTADOS_SOLICITUD = ["pendiente", "registrada", "no_corresponde"] as const;
type EstadoSolicitud = (typeof ESTADOS_SOLICITUD)[number];

// Cambia el estado de seguimiento de una solicitud: "registrada" la tilda una persona después de
// confirmar que la conexión real corresponde a esta solicitud puntual (distinto del aviso
// automático por DNI, que es solo un indicio); "no_corresponde" la descarta con un motivo (ya es
// cliente, sin cobertura, duplicado, etc.). Queda quién y cuándo para poder auditarlo.
export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  let body: { id?: number; estado?: string; id_conexion?: number | null; motivo?: string | null };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  const id = Number(body.id);
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: "id inválido" }, { status: 400 });
  if (!ESTADOS_SOLICITUD.includes(body.estado as EstadoSolicitud))
    return NextResponse.json({ error: "Estado inválido" }, { status: 400 });
  const estado = body.estado as EstadoSolicitud;

  const motivo = typeof body.motivo === "string" ? body.motivo.trim().slice(0, 300) : "";
  if (estado === "no_corresponde" && !motivo)
    return NextResponse.json({ error: "Falta el motivo" }, { status: 400 });

  try {
    const pool = await getPool();
    await ensureTable(pool);

    const { sucursales: sucursalesPermitidas } = session.user;
    if (sucursalesPermitidas !== null) {
      const check = await pool.request().input("id", sql.Int, id).query(`SELECT cod_sucursal FROM ${TABLA} WHERE id = @id`);
      const cod = check.recordset[0]?.cod_sucursal;
      if (cod === undefined) return NextResponse.json({ error: "Solicitud no encontrada" }, { status: 404 });
      if (!sucursalesPermitidas.includes(cod)) return NextResponse.json({ error: "Sin acceso" }, { status: 403 });
    }

    const instalada = estado === "registrada";
    const noCorresponde = estado === "no_corresponde";
    const idConexion = instalada && Number.isInteger(body.id_conexion) ? body.id_conexion! : null;

    await pool.request()
      .input("id", sql.Int, id)
      .input("instalada", sql.Bit, instalada)
      .input("id_conexion", sql.Int, idConexion)
      .input("instalada_usuario", sql.NVarChar(100), instalada ? session.user.user : null)
      .input("no_corresponde", sql.Bit, noCorresponde)
      .input("motivo", sql.NVarChar(300), noCorresponde ? motivo : null)
      .input("no_corresponde_usuario", sql.NVarChar(100), noCorresponde ? session.user.user : null)
      .query(`
        UPDATE ${TABLA}
        SET instalada = @instalada,
            instalada_id_conexion = @id_conexion,
            instalada_usuario = @instalada_usuario,
            instalada_fecha = CASE WHEN @instalada = 1 THEN GETDATE() ELSE NULL END,
            no_corresponde = @no_corresponde,
            no_corresponde_motivo = @motivo,
            no_corresponde_usuario = @no_corresponde_usuario,
            no_corresponde_fecha = CASE WHEN @no_corresponde = 1 THEN GETDATE() ELSE NULL END
        WHERE id = @id
      `);
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    console.error("[solicitudes-conexion PATCH]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

// Eliminar una solicitud es destructivo (documento/DNI del titular incluido) y hoy solo lo puede
// hacer mromero, a pedido suyo — no hay un rol de "admin" general para esta pantalla todavía.
export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (session.user.user !== "mromero") return NextResponse.json({ error: "Sin permiso" }, { status: 403 });

  let body: { id?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  const id = Number(body.id);
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: "id inválido" }, { status: 400 });

  try {
    const pool = await getPool();
    await ensureTable(pool);
    await pool.request().input("id", sql.Int, id).query(`DELETE FROM ${TABLA} WHERE id = @id`);
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    console.error("[solicitudes-conexion DELETE]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
