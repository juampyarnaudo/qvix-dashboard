import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const CSV_PATH = path.join(process.cwd(), "public", "gotv_data.csv");
const HISTORY_PATH = path.join(process.cwd(), "public", "gotv_history.json");

export async function GET() {
  try {
    const history = JSON.parse(fs.readFileSync(HISTORY_PATH, "utf-8"));
    return NextResponse.json(history);
  } catch {
    return NextResponse.json([]);
  }
}

// POST { index: number } → restaura ese snapshot
export async function POST(req: NextRequest) {
  try {
    const { index } = await req.json();
    const history: { ts: string; description: string; csv: string }[] = JSON.parse(
      fs.readFileSync(HISTORY_PATH, "utf-8")
    );
    if (index < 0 || index >= history.length) {
      return NextResponse.json({ error: "Índice inválido" }, { status: 400 });
    }
    fs.writeFileSync(CSV_PATH, history[index].csv, "utf-8");
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
