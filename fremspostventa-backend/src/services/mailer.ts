// src/services/mailer.ts
import prisma from '../prisma';
import nodemailer from 'nodemailer';

const smtpEnabled = !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

const transporter = smtpEnabled
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST!,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: false,
      auth: { user: process.env.SMTP_USER!, pass: process.env.SMTP_PASS! },
    })
  : null;

export async function sendEmail(opts: {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
}) {
  if (!transporter) {
    // SMTP no configurado: no rompas el flujo, solo loggea
    console.log('[mailer:mock]', {
      to: opts.to,
      subject: opts.subject,
      text: opts.text,
      html: opts.html ? '(html)' : undefined,
    });
    return { ok: false, skipped: true };
  }

  const toList = Array.isArray(opts.to) ? opts.to.join(',') : opts.to;

  const info = await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER!,
    to: toList,
    subject: opts.subject,
    text: opts.text,
    html: opts.html,
  });

  return { ok: true, messageId: info.messageId };
}

/** Emails de vendedores activos (si luego asignás dueño de cliente, cámbialo aquí) */
export async function correosVendedores(): Promise<string[]> {
  const vend = await prisma.usuarios.findMany({
    where: { activo: true, roles: { nombre: { equals: 'vendedor', mode: 'insensitive' } } },
    select: { email: true },
  });
  return vend.map(v => v.email).filter(Boolean) as string[];
}

/** Alerta al equipo de ventas con preview y opciones */
export async function enviarAlertaVendedores(params: {
  recId: number;
  clienteNombre: string;
  preview: string;
  opciones: Array<{ nombre: string; sku?: string|null; medida?: string|null }>;
  vendedorNombre?: string | null;
}) {
  if (!transporter) return { ok: false, skipped: true };

  const to = (await correosVendedores()).join(',');
  if (!to) return { ok: false, skipped: true };

  const base = process.env.APP_BASE_URL || 'http://localhost:4200';
  const detalleUrl = `${base}/recomendaciones/${params.recId}`;

  const subject = `Nueva recomendación IA – ${params.clienteNombre} (#${params.recId})`;

  const list = params.opciones
    .map(o => `• ${o.nombre}${o.medida ? ' ' + o.medida : ''}`)
    .join('\n') || '—';

  const saludo = params.vendedorNombre
    ? `Hola ${params.vendedorNombre},`
    : 'Hola,';

  const text =
`${saludo}

Tienes una nueva sugerencia personalizada para el cliente: ${params.clienteNombre}.

Resumen (mensaje sugerido):
${params.preview}

Opciones sugeridas:
${list}

Siguiente paso:
• Revisa el detalle para copiar el mensaje y contactar por WhatsApp.
• Ver detalle: ${detalleUrl}

— Postventa IA
— Frem's`
;

  const info = await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER!,
    to,
    subject,
    text,
  });
  return { ok: true, messageId: info.messageId };
}

//Correo de password temporal

export async function enviarAccesoInicial(params: {
  to: string,
  nombre?: string | null,
  username: string,
  tempPassword: string,
}) {
  if (!transporter) return { ok: false, skipped: true };

  const subject = 'Tu acceso inicial – Frem’s';
  const saludo = params.nombre ? `Hola ${params.nombre},` : 'Hola,';
  const base = process.env.APP_BASE_URL || 'http://localhost:4200';

  const text = `${saludo}

Tu cuenta fue creada en el sistema de Postventa.

Usuario: ${params.username}
Contraseña temporal: ${params.tempPassword}

Por seguridad, cámbiala al ingresar:
${base}/recuperar-reset?email=${encodeURIComponent(params.to)}

— Equipo Frem’s`;

  const info = await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER!,
    to: params.to,
    subject,
    text,
  });

  return { ok: true, messageId: info.messageId };
}
