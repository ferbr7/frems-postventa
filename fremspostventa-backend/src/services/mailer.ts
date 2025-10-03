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

/** Destinatarios: vendedores activos. 
 * Si luego asignas dueño del cliente, cámbialo aquí.
 */
export async function correosVendedores(): Promise<string[]> {
  const vend = await prisma.usuarios.findMany({
    where: { activo: true, roles: { nombre: { equals: 'vendedor', mode: 'insensitive' } } },
    select: { email: true },
  });
  return vend.map(v => v.email).filter(Boolean) as string[];
}

export async function enviarAlertaVendedores(params: {
  recId: number;
  clienteNombre: string;
  preview: string;               // primeras líneas de la justificación
  opciones: Array<{ nombre: string; sku?: string|null; medida?: string|null }>;
}) {
  if (!transporter) return { ok: false, skipped: true };

  const to = (await correosVendedores()).join(',');
  if (!to) return { ok: false, skipped: true };

  const subject = `Nueva recomendación IA – ${params.clienteNombre} (#${params.recId})`;
  const list = params.opciones.map(o => `• ${o.nombre}${o.medida ? ' ' + o.medida : ''}${o.sku ? ' (SKU: ' + o.sku + ')' : ''}`).join('\n');

  const text =
`Cliente: ${params.clienteNombre}
Recomendación #${params.recId}

Resumen:
${params.preview}

Opciones sugeridas:
${list}

Acción sugerida:
• Contactá por WhatsApp o email al cliente.
• Podés ver el detalle en el sistema (Ruta: /recs/${params.recId}).`;

  const info = await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER!,
    to,
    subject,
    text,
  });
  return { ok: true, messageId: info.messageId };
}
