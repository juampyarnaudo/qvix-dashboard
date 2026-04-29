import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/app/lib/session";

interface AuthUser { user: string; pass: string; nombre: string; }

function getUsers(): AuthUser[] {
  try {
    return JSON.parse(process.env.AUTH_USERS ?? "[]");
  } catch {
    return [];
  }
}

export async function POST(req: NextRequest) {
  const { user, pass } = await req.json();

  const found = getUsers().find((u) => u.user === user && u.pass === pass);
  if (!found) {
    return NextResponse.json({ error: "Usuario o contraseña incorrectos" }, { status: 401 });
  }

  const session = await getSession();
  session.user = { user: found.user, nombre: found.nombre };
  await session.save();

  return NextResponse.json({ ok: true });
}
