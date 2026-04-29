import { NextResponse } from "next/server";
import { getSession } from "@/app/lib/session";

export async function GET() {
  const session = await getSession();
  if (!session.user) return NextResponse.json(null);
  return NextResponse.json(session.user);
}
