import * as sql from "mssql";
import { NextResponse } from "next/server";

const config: sql.config = {
  server: process.env.DB_SERVER!,
  port: Number(process.env.DB_PORT),
  user: process.env.DB_USER!,
  password: process.env.DB_PASSWORD!,
  database: process.env.DB_DATABASE || undefined,
  options: {
    encrypt: false,
    trustServerCertificate: true,
  },
};

export async function GET() {
  try {
    await sql.connect(config);
    const result = await sql.query("SELECT DB_NAME() AS base, GETDATE() AS fecha");
    await (sql as any).close();
    return NextResponse.json({ ok: true, data: result.recordset[0] });
  } catch (err: unknown) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
