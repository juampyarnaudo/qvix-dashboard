import { getIronSession, IronSession } from "iron-session";
import { cookies } from "next/headers";

export interface SessionData {
  user?: {
    user: string;
    nombre: string;
    sucursales: number[] | null;
    secciones: string[] | null;
    // Acciones bloqueadas dentro de Solicitudes de Conexión: "exportar" | "planes" | "qr".
    solicitudesRestricciones?: string[];
    // Sección que se abre automáticamente al iniciar sesión, ej. "solicitudes".
    vistaInicial?: string;
  };
}

const sessionOptions = {
  password: process.env.SESSION_SECRET ?? "fallback_secret_minimo_32_caracteres_xx",
  cookieName: "qvix_session",
  ttl: 60 * 60 * 8, // 8 horas
  cookieOptions: { secure: process.env.NODE_ENV === "production" },
};

export async function getSession(): Promise<IronSession<SessionData>> {
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, sessionOptions);
}
