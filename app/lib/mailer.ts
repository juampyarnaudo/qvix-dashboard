import nodemailer, { type Transporter } from "nodemailer";

// Envío de correos transaccionales (hoy: solicitud de conexión). Reutiliza la misma cuenta SMTP
// que /api/contacto-web (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS en Vercel). El diseño del
// layout copia la paleta y tipografía del sitio institucional / formulario público, ver
// app/components/SolicitudPublicaForm.tsx (PURPLE_DARK, PURPLE, ACCENT, etc.).
const PURPLE_DARK = "#2E1252";
const PURPLE = "#6B3FA0";
const ACCENT = "#3FE0F5";
const LILAC_SOFT = "#F6F3FB";
const TEXT_MUTED = "#8A8798";
const TEXT_BODY = "#4a4458";
const TEXT_STRONG = "#2b2438";

let transporte: Transporter | null = null;

function getTransporte(): Transporter {
  if (transporte) return transporte;
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) throw new Error("Faltan las variables SMTP_HOST, SMTP_USER o SMTP_PASS");
  const puerto = Number(SMTP_PORT ?? 465);
  transporte = nodemailer.createTransport({
    host: SMTP_HOST,
    port: puerto,
    secure: puerto === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
  return transporte;
}

export async function enviarCorreo(opts: { to: string; subject: string; html: string; replyTo?: string }): Promise<void> {
  const { SMTP_USER } = process.env;
  await getTransporte().sendMail({
    from: { name: "Ultranet", address: SMTP_USER! },
    to: opts.to,
    replyTo: opts.replyTo,
    subject: opts.subject,
    html: opts.html,
  });
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function fila(etiqueta: string, valor: string | null | undefined): string {
  const limpio = (valor ?? "").replace(/[\r\n]+/g, " ").trim();
  if (!limpio) return "";
  return `
    <tr>
      <td style="padding:6px 0;color:${TEXT_MUTED};font-size:13px;vertical-align:top;white-space:nowrap;padding-right:14px;">${escapeHtml(etiqueta)}</td>
      <td style="padding:6px 0;color:${TEXT_STRONG};font-size:14px;font-weight:600;">${escapeHtml(limpio)}</td>
    </tr>`;
}

// Arma las filas de la "tarjeta" de datos del mail. Las filas sin valor se omiten.
export function filasDatos(filas: [string, string | null | undefined][]): string {
  return filas.map(([k, v]) => fila(k, v)).join("");
}

export function layoutEmail(opts: {
  logoUrl: string;
  eyebrow: string;
  titulo: string;
  saludo?: string;
  parrafos: string[];
  filasHtml: string;
  parrafoFinal?: string;
  cta?: { texto: string; href: string };
}): string {
  const { logoUrl, eyebrow, titulo, saludo, parrafos, filasHtml, parrafoFinal, cta } = opts;
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${titulo}</title>
</head>
<body style="margin:0;padding:0;background-color:#EDE7F6;font-family:'Segoe UI',Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#EDE7F6;padding:32px 12px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:100%;background-color:#ffffff;border-radius:16px;overflow:hidden;">
        <tr>
          <td style="background-color:${PURPLE_DARK};background-image:linear-gradient(135deg, ${PURPLE_DARK}, ${PURPLE});padding:32px 24px;text-align:center;">
            <img src="${logoUrl}" width="160" alt="Ultranet" style="display:block;margin:0 auto 18px;border:0;max-width:160px;">
            <p style="margin:0 0 6px;color:${ACCENT};font-size:12px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;">${eyebrow}</p>
            <h1 style="margin:0;color:#ffffff;font-size:21px;font-weight:700;">${titulo}</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 28px;">
            ${saludo ? `<p style="margin:0 0 14px;color:${TEXT_STRONG};font-size:15px;">${saludo}</p>` : ""}
            ${parrafos.map((p) => `<p style="margin:0 0 14px;color:${TEXT_BODY};font-size:14px;line-height:1.55;">${p}</p>`).join("")}
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${LILAC_SOFT};border-radius:12px;padding:18px 20px;margin:4px 0 18px;">
              ${filasHtml}
            </table>
            ${parrafoFinal ? `<p style="margin:0 0 6px;color:${TEXT_BODY};font-size:14px;line-height:1.55;">${parrafoFinal}</p>` : ""}
            ${cta ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0 4px;"><tr><td style="border-radius:999px;background-color:${PURPLE_DARK};"><a href="${cta.href}" style="display:inline-block;padding:12px 26px;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;border-radius:999px;">${escapeHtml(cta.texto)}</a></td></tr></table>` : ""}
          </td>
        </tr>
        <tr>
          <td style="padding:18px 28px;background-color:${LILAC_SOFT};text-align:center;">
            <p style="margin:0;color:${TEXT_MUTED};font-size:11px;line-height:1.5;">Este es un mensaje automático de Ultranet — no es necesario responderlo.<br>Catamarca, Argentina · ultranet.com.ar</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
