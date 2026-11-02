import { NextResponse } from "next/server";
import { getPool } from "@/app/lib/db";
import { getSession } from "@/app/lib/session";

const SUCURSALES_VALIDAS = [1, 4, 5, 6, 7, 8];

const WHERE_TV = `(
    fco.descripcion LIKE '%GO TV%'
    OR fco.descripcion LIKE '%SONO PACK%'
    OR fco.descripcion = 'CABLE TV'
  )
  AND fco.descripcion NOT LIKE '%DESC%'
  AND fco.descripcion NOT LIKE '%BONIF%'
  AND fco.descripcion NOT LIKE '%INSTAL%'
  AND fco.descripcion NOT LIKE '%PROMO%'
  AND fco.descripcion NOT LIKE '%FUTBOL%'
  AND fco.descripcion NOT LIKE '%DEPORTI%'
  AND fco.descripcion NOT LIKE '%HBO%'
  AND fco.descripcion NOT LIKE '%CINE%'
  AND fco.descripcion NOT LIKE '%UNIVERSAL%'
  AND fco.descripcion NOT LIKE '%SENSA%'`;

const WHERE_TV2 = WHERE_TV.replace(/fco\./g, "fco2.");
const WHERE_TV3 = WHERE_TV.replace(/fco\./g, "fco3.");

type Pool = Awaited<ReturnType<typeof getPool>>;

async function ensureTable(pool: Pool) {
  await pool.request().query(`
    IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'analytics_bajasqvix')
    CREATE TABLE analytics_bajasqvix (
      id            INT IDENTITY(1,1) PRIMARY KEY,
      id_conexion   INT          NOT NULL,
      nombre        VARCHAR(255) NULL,
      cod_sucursal  INT          NULL,
      concepto_tv   VARCHAR(255) NULL,
      fecha_baja    VARCHAR(20)  NULL,
      lote_mes      VARCHAR(7)   NOT NULL,
      lote_fecha    DATE         NOT NULL,
      guardado_por  VARCHAR(100) NULL
    )
  `);
}

function esc(s: string) {
  return (s ?? "").replace(/'/g, "''");
}

export async function GET() {
  const session = await getSession();
  if (!session.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { sucursales: permitidas } = session.user;
  const sucursalesBase = (permitidas ?? SUCURSALES_VALIDAS).filter((s) =>
    SUCURSALES_VALIDAS.includes(s)
  );

  const pool = await getPool();
  await ensureTable(pool);

  try {
    const result = await pool.request().query(`
      WITH
      bajas_tv AS (
        -- Detección por facturación: items TV en estado baja (estado=9) sin item activo
        SELECT
          fc.id_conexion,
          fco.descripcion,
          fc.fecha_carga,
          ROW_NUMBER() OVER (
            PARTITION BY fc.id_conexion
            ORDER BY fc.fecha_carga DESC
          ) AS rn
        FROM facturas_cuentas fc WITH (NOLOCK)
        INNER JOIN facturas_conceptos fco WITH (NOLOCK) ON fco.cod_concepto = fc.cod_concepto
        WHERE fc.estado = 9
          AND ${WHERE_TV}
          AND NOT EXISTS (
            SELECT 1 FROM facturas_cuentas fc2 WITH (NOLOCK)
            INNER JOIN facturas_conceptos fco2 WITH (NOLOCK) ON fco2.cod_concepto = fc2.cod_concepto
            WHERE fc2.id_conexion = fc.id_conexion AND fc2.estado = 0
              AND ${WHERE_TV2}
          )
      ),
      estado_bajas AS (
        -- Detección por estado de conexión: Cortado/Anulado/Gestión de Corte/Baja Voluntaria con dispositivo QVIX/CUBIWARE
        SELECT
          v.id_conexion,
          COALESCE(
            (SELECT TOP 1 fco3.descripcion
             FROM facturas_cuentas fc3 WITH (NOLOCK)
             INNER JOIN facturas_conceptos fco3 WITH (NOLOCK) ON fco3.cod_concepto = fc3.cod_concepto
             WHERE fc3.id_conexion = v.id_conexion
               AND ${WHERE_TV3}
             ORDER BY fc3.estado ASC, fc3.fecha_carga DESC),
            'QVIX/CUBIWARE'
          ) AS descripcion,
          CAST(GETDATE() AS DATETIME) AS fecha_carga,
          ROW_NUMBER() OVER (PARTITION BY v.id_conexion ORDER BY (SELECT NULL)) AS rn
        FROM v_con_dom v WITH (NOLOCK)
        INNER JOIN conexion_dispostivos cd WITH (NOLOCK) ON cd.id_conexion = v.id_conexion AND cd.estado = 0
        INNER JOIN DISPOSITIVOS d WITH (NOLOCK) ON d.id_dispositivo = cd.id_dispositivo
          AND d.tipo_cuenta_usuario IN ('QVIX', 'CUBIWARE')
        WHERE v.Estado_Servicio IN (4, 5, 7, 61)
          AND NOT EXISTS (
            SELECT 1 FROM bajas_tv bt WHERE bt.id_conexion = v.id_conexion AND bt.rn = 1
          )
      ),
      combined AS (
        SELECT id_conexion, descripcion, fecha_carga FROM bajas_tv WHERE rn = 1
        UNION ALL
        SELECT id_conexion, descripcion, fecha_carga FROM estado_bajas WHERE rn = 1
      )
      SELECT
        b.id_conexion      AS conexion,
        ab.apellido_nombre AS nombre,
        con.cod_sucursal,
        b.descripcion      AS concepto_tv,
        CONVERT(VARCHAR, b.fecha_carga, 5) AS fecha_baja
      FROM combined b
      INNER JOIN conexiones con WITH (NOLOCK) ON con.id_conexion = b.id_conexion
      INNER JOIN abonados ab WITH (NOLOCK) ON ab.id_abonado = con.id_abonado
      WHERE con.cod_sucursal IN (${sucursalesBase.join(",")})
        AND NOT EXISTS (
          SELECT 1 FROM analytics_bajasqvix aq WHERE aq.id_conexion = b.id_conexion
        )
      ORDER BY b.fecha_carga DESC
    `);

    const historial = await pool.request().query(`
      SELECT
        lote_mes,
        CONVERT(VARCHAR, MIN(lote_fecha), 5) AS fecha_cierre,
        COUNT(*) AS total,
        MIN(guardado_por) AS guardado_por
      FROM analytics_bajasqvix
      GROUP BY lote_mes
      ORDER BY lote_mes DESC
    `);

    return NextResponse.json({
      rows: result.recordset,
      lotes: historial.recordset,
      generado: new Date().toISOString(),
    });
  } catch (err: unknown) {
    console.error("[tv-bajas-qvix GET]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

interface BajaInput {
  conexion: number;
  nombre: string;
  cod_sucursal: number;
  concepto_tv: string;
  fecha_baja: string;
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { rows } = (await req.json()) as { rows: BajaInput[] };
  if (!rows?.length) return NextResponse.json({ error: "Sin datos" }, { status: 400 });

  const pool = await getPool();
  await ensureTable(pool);

  const now = new Date();
  const loteMes = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const loteFecha = now.toISOString().slice(0, 10);
  const guardadoPor = esc(session.user.user);

  try {
    // insertar de a 200 filas por request para evitar queries gigantes
    const chunkSize = 200;
    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize);
      const values = chunk
        .map(
          (r) =>
            `(${r.conexion}, '${esc(r.nombre)}', ${r.cod_sucursal ?? "NULL"}, '${esc(r.concepto_tv)}', '${esc(r.fecha_baja)}', '${loteMes}', '${loteFecha}', '${guardadoPor}')`
        )
        .join(",\n");

      await pool.request().query(`
        INSERT INTO analytics_bajasqvix
          (id_conexion, nombre, cod_sucursal, concepto_tv, fecha_baja, lote_mes, lote_fecha, guardado_por)
        VALUES ${values}
      `);
    }

    return NextResponse.json({ ok: true, insertados: rows.length, lote_mes: loteMes });
  } catch (err: unknown) {
    console.error("[tv-bajas-qvix POST]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
