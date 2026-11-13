import { NextRequest, NextResponse } from "next/server";
import https from "node:https";
import { getSession } from "@/app/lib/session";

export const maxDuration = 60;

const SMP_BASE_URL = process.env.ZTE_SMP_BASE_URL ?? "https://zte-smp.com.ar:8081/PlatformAPI";
const MAX_SERIALES_POR_LOTE = 20;
const MAX_ERRORES_SEGUIDOS = 5;

// El servidor de zte-smp.com.ar no manda el root CA en la cadena TLS (solo el leaf +
// intermedio), así que Node no puede completar la validación con su bundle por defecto.
// Se agrega el root real de Sectigo ("Sectigo Public Server Authentication Root R46",
// vigencia 2021-2046) como CA de confianza para esta conexión puntual — la verificación
// de certificado sigue activa (rejectUnauthorized por defecto), solo se completa la cadena.
const SECTIGO_ROOT_R46 = `-----BEGIN CERTIFICATE-----
MIIFijCCA3KgAwIBAgIQdY39i658BwD6qSWn4cetFDANBgkqhkiG9w0BAQwFADBf
MQswCQYDVQQGEwJHQjEYMBYGA1UEChMPU2VjdGlnbyBMaW1pdGVkMTYwNAYDVQQD
Ey1TZWN0aWdvIFB1YmxpYyBTZXJ2ZXIgQXV0aGVudGljYXRpb24gUm9vdCBSNDYw
HhcNMjEwMzIyMDAwMDAwWhcNNDYwMzIxMjM1OTU5WjBfMQswCQYDVQQGEwJHQjEY
MBYGA1UEChMPU2VjdGlnbyBMaW1pdGVkMTYwNAYDVQQDEy1TZWN0aWdvIFB1Ymxp
YyBTZXJ2ZXIgQXV0aGVudGljYXRpb24gUm9vdCBSNDYwggIiMA0GCSqGSIb3DQEB
AQUAA4ICDwAwggIKAoICAQCTvtU2UnXYASOgHEdCSe5jtrch/cSV1UgrJnwUUxDa
ef0rty2k1Cz66jLdScK5vQ9IPXtamFSvnl0xdE8H/FAh3aTPaE8bEmNtJZlMKpnz
SDBh+oF8HqcIStw+KxwfGExxqjWMrfhu6DtK2eWUAtaJhBOqbchPM8xQljeSM9xf
iOefVNlI8JhD1mb9nxc4Q8UBUQvX4yMPFF1bFOdLvt30yNoDN9HWOaEhUTCDsG3X
ME6WW5HwcCSrv0WBZEMNvSE6Lzzpng3LILVCJ8zab5vuZDCQOc2TZYEhMbUjUDM3
IuM47fgxMMxF/mL50V0yeUKH32rMVhlATc6qu/m1dkmU8Sf4kaWD5QazYw6A3OAS
VYCmO2a0OYctyPDQ0RTp5A1NDvZdV3LFOxxHVp3i1fuBYYzMTYCQNFu31xR13NgE
SJ/AwSiItOkcyqex8Va3e0lMWeUgFaiEAin6OJRpmkkGj80feRQXEgyDet4fsZfu
+Zd4KKTIRJLpfSYFplhym3kT2BFfrsU4YjRosoYwjviQYZ4ybPUHNs2iTG7sijbt
8uaZFURww3y8nDnAtOFr94MlI1fZEoDlSfB1D++N6xybVCi0ITz8fAr/73trdf+L
HaAZBav6+CuBQug4urv7qv094PPK306Xlynt8xhW6aWWrL3DkJiy4Pmi1KZHQ3xt
zwIDAQABo0IwQDAdBgNVHQ4EFgQUVnNYZJX5khqwEioEYnmhQBWIIUkwDgYDVR0P
AQH/BAQDAgGGMA8GA1UdEwEB/wQFMAMBAf8wDQYJKoZIhvcNAQEMBQADggIBAC9c
mTz8Bl6MlC5w6tIyMY208FHVvArzZJ8HXtXBc2hkeqK5Duj5XYUtqDdFqij0lgVQ
YKlJfp/imTYpE0RHap1VIDzYm/EDMrraQKFz6oOht0SmDpkBm+S8f74TlH7Kph52
gDY9hAaLMyZlbcp+nv4fjFg4exqDsQ+8FxG75gbMY/qB8oFM2gsQa6H61SilzwZA
Fv97fRheORKkU55+MkIQpiGRqRxOF3yEvJ+M0ejf5lG5Nkc/kLnHvALcWxxPDkjB
JYOcCj+esQMzEhonrPcibCTRAUH4WAP+JWgiH5paPHxsnnVI84HxZmduTILA7rpX
DhjvLpr3Etiga+kFpaHpaPi8TD8SHkXoUsCjvxInebnMMTzD9joiFgOgyY9mpFui
TdaBJQbpdqQACj7LzTWb4OE4y2BThihCQRxEV+ioratF4yUQvNs+ZUH7G6aXD+u5
dHn5HrwdVw1Hr8Mvn4dGp+smWg9WY7ViYG4A++MnESLn/pmPNPW56MORcr3Ywx65
LvKRRFHQV80MNNVIIb/bE/FmJUNS0nAiNs2fxBx1IK1jcmMGDw4nztJqDby1ORrp
0XZ60Vzk50lJLVU3aPAaOpg+VBeHVOmmJ1CJeyAvP/+/oYtKR5j/K3tJPsMpRmAY
QqszKbrAKbkTidOIijlBO8n9pu0f9GBj39ItVQGL
-----END CERTIFICATE-----`;

interface Resultado {
  snserial: string;
  resultado: "OK" | "FALLO" | "ERROR";
  returncode: string | null;
  errormsg: string | null;
  fecha: string;
}

function smpRequest(path: string, payload: unknown, token?: string): Promise<{ status: number; body: Record<string, unknown> }> {
  return new Promise((resolve, reject) => {
    const url = new URL(`${SMP_BASE_URL}/${path}`);
    const data = JSON.stringify(payload);
    const req = https.request(
      {
        hostname: url.hostname,
        port: url.port || 443,
        path: url.pathname,
        method: "POST",
        ca: SECTIGO_ROOT_R46,
        timeout: 60_000,
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(data),
          ...(token ? { token } : {}),
        },
      },
      (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => {
          try {
            resolve({ status: res.statusCode ?? 0, body: JSON.parse(body) });
          } catch (err) {
            reject(err);
          }
        });
      }
    );
    req.on("timeout", () => req.destroy(new Error("Timeout conectando a SMP")));
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

let tokenCache: string | null = null;

async function smpLogin(): Promise<string> {
  const username = process.env.ZTE_SMP_USERNAME;
  const password = process.env.ZTE_SMP_PASSWORD;
  const tenantid = process.env.ZTE_SMP_TENANTID;
  if (!username || !password || !tenantid) {
    throw new Error("Faltan las variables ZTE_SMP_USERNAME / ZTE_SMP_PASSWORD / ZTE_SMP_TENANTID en el servidor");
  }

  const { body } = await smpRequest("NI_Login", { username, password, tenantid });
  if (String(body.returncode) !== "0" || !body.token) {
    throw new Error(`Login SMP falló: ${body.errormsg ?? body.returncode}`);
  }
  tokenCache = String(body.token);
  return tokenCache;
}

async function apiUnlock(snserial: string): Promise<{ returncode: string; errormsg: string | null }> {
  if (!tokenCache) await smpLogin();

  let { status, body } = await smpRequest("NI_STBUnlock", { snserial }, tokenCache!);
  if (status === 401) {
    await smpLogin();
    ({ status, body } = await smpRequest("NI_STBUnlock", { snserial }, tokenCache!));
  }
  return { returncode: String(body.returncode), errormsg: (body.errormsg as string) ?? null };
}

async function unlockConRetry(snserial: string, retries = 3): Promise<{ returncode: string; errormsg: string | null }> {
  let lastErr: unknown;
  for (let i = 0; i < retries; i++) {
    try {
      return await apiUnlock(snserial);
    } catch (err) {
      lastErr = err;
      if (i < retries - 1) await new Promise((r) => setTimeout(r, 1000 * 2 ** i));
    }
  }
  throw lastErr;
}

// Acción sensible (desbloquea equipos reales de clientes en SMP) — restringida a usuarios
// puntuales, no a toda la sección "dispositivos".
const USUARIOS_PERMITIDOS = ["mromero", "jarnaudo"];

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!USUARIOS_PERMITIDOS.includes(session.user.user))
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });

  if (!process.env.ZTE_SMP_USERNAME || !process.env.ZTE_SMP_PASSWORD || !process.env.ZTE_SMP_TENANTID) {
    return NextResponse.json({ error: "El servidor no tiene configuradas las credenciales ZTE_SMP_*" }, { status: 500 });
  }

  let body: { seriales?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const seriales = Array.isArray(body.seriales)
    ? body.seriales.filter((s): s is string => typeof s === "string" && s.trim().length > 0).map((s) => s.trim())
    : [];
  if (seriales.length === 0) return NextResponse.json({ error: "No se recibieron seriales" }, { status: 400 });
  if (seriales.length > MAX_SERIALES_POR_LOTE)
    return NextResponse.json({ error: `Máximo ${MAX_SERIALES_POR_LOTE} seriales por lote` }, { status: 400 });

  const resultados: Resultado[] = [];
  let erroresSeguidos = 0;
  let detenido = false;

  for (const snserial of seriales) {
    try {
      const { returncode, errormsg } = await unlockConRetry(snserial);
      resultados.push({ snserial, resultado: returncode === "0" ? "OK" : "FALLO", returncode, errormsg, fecha: new Date().toISOString() });
      erroresSeguidos = 0;
    } catch (err) {
      resultados.push({
        snserial,
        resultado: "ERROR",
        returncode: null,
        errormsg: (err instanceof Error ? err.message : String(err)).slice(0, 255),
        fecha: new Date().toISOString(),
      });
      erroresSeguidos++;
    }

    if (erroresSeguidos >= MAX_ERRORES_SEGUIDOS) {
      detenido = true;
      break;
    }
  }

  return NextResponse.json({ resultados, detenido });
}
