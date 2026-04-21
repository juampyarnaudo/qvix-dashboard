import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const CSV_PATH = path.join(process.cwd(), "public", "gotv_data.csv");
const HISTORY_PATH = path.join(process.cwd(), "public", "gotv_history.json");
const MAX_HISTORY = 20;

function saveSnapshot(csvContent: string, description: string) {
  let history: { ts: string; description: string; csv: string }[] = [];
  try {
    history = JSON.parse(fs.readFileSync(HISTORY_PATH, "utf-8"));
  } catch {}
  history.unshift({ ts: new Date().toISOString(), description, csv: csvContent });
  if (history.length > MAX_HISTORY) history = history.slice(0, MAX_HISTORY);
  fs.writeFileSync(HISTORY_PATH, JSON.stringify(history, null, 2), "utf-8");
}

export async function GET() {
  try {
    const text = fs.readFileSync(CSV_PATH, "utf-8");
    return new NextResponse(text, { headers: { "Content-Type": "text/csv" } });
  } catch {
    return new NextResponse("servicio,organizacion,fecha,stb,movil\n", {
      headers: { "Content-Type": "text/csv" },
    });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { servicio = "GOTV", organizacion, fecha, stb, movil } = body;

    if (!organizacion || !fecha || stb === undefined || movil === undefined) {
      return NextResponse.json({ error: "Datos incompletos" }, { status: 400 });
    }

    let csv = "";
    if (fs.existsSync(CSV_PATH)) {
      csv = fs.readFileSync(CSV_PATH, "utf-8");
    } else {
      csv = "servicio,organizacion,fecha,stb,movil\n";
    }

    const lines = csv.split("\n").filter((l) => l.trim() !== "");
    const header = lines[0];

    // Migrar CSV viejo sin columna servicio (retrocompatibilidad)
    const cols = header.split(",").map((c) => c.trim().toLowerCase());
    const hasServicio = cols[0] === "servicio";
    let dataLines = lines.slice(1);

    if (!hasServicio) {
      // Agregar columna servicio=GOTV a todas las filas existentes
      dataLines = dataLines.map((l) => `GOTV,${l}`);
      const newCsv = ["servicio,organizacion,fecha,stb,movil", ...dataLines].join("\n") + "\n";
      fs.writeFileSync(CSV_PATH, newCsv, "utf-8");
      dataLines = newCsv.split("\n").filter((l) => l.trim() !== "").slice(1);
    }

    // Guardar snapshot antes de modificar
    const currentCsv = fs.existsSync(CSV_PATH) ? fs.readFileSync(CSV_PATH, "utf-8") : "";
    saveSnapshot(currentCsv, `${servicio} / ${organizacion} / ${fecha}: STB=${stb}, Móvil=${movil}`);

    const newLine = `${servicio},${organizacion},${fecha},${stb},${movil}`;
    const existingIdx = dataLines.findIndex((l) => {
      const [s, o, f] = l.split(",");
      return s === servicio && o === organizacion && f === fecha;
    });

    if (existingIdx >= 0) {
      dataLines[existingIdx] = newLine;
    } else {
      dataLines.push(newLine);
    }

    const updated = ["servicio,organizacion,fecha,stb,movil", ...dataLines].join("\n") + "\n";
    fs.writeFileSync(CSV_PATH, updated, "utf-8");

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { servicio, organizacion, fecha } = await req.json();
    if (!fs.existsSync(CSV_PATH)) return NextResponse.json({ ok: true });

    const csv = fs.readFileSync(CSV_PATH, "utf-8");
    const lines = csv.split("\n").filter((l) => l.trim() !== "");
    const header = lines[0];
    const dataLines = lines.slice(1).filter((l) => {
      const [s, o, f] = l.split(",");
      return !(s === servicio && o === organizacion && f === fecha);
    });

    // Guardar snapshot antes de eliminar
    saveSnapshot(csv, `Eliminado: ${servicio} / ${organizacion} / ${fecha}`);

    const updated = [header, ...dataLines].join("\n") + "\n";
    fs.writeFileSync(CSV_PATH, updated, "utf-8");
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
