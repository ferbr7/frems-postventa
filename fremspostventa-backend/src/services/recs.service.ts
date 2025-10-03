import prisma from '../prisma';
import OpenAI from 'openai';

function toDateOnlyUTC(s?: string | null): Date | null {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const y = Number(m[1]); const mo = Number(m[2]); const d = Number(m[3]);
  return new Date(Date.UTC(y, mo - 1, d));
}
function todayLocalISO(): string {
  const t = new Date();
  const y = t.getFullYear();
  const m = String(t.getMonth() + 1).padStart(2, '0');
  const d = String(t.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
const daysBetween = (a: Date, b: Date) => Math.floor((b.getTime() - a.getTime()) / 86400000);
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const fullName = (c?: { nombre?: string|null; apellido?: string|null }) =>
  `${c?.nombre ?? ''} ${c?.apellido ?? ''}`.trim() || 'Cliente';

const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

export async function refreshCandidatesMV() {
  await prisma.$executeRawUnsafe('REFRESH MATERIALIZED VIEW rec_candidates_daily;');
}

/** Señales y TOP-N (con boost al producto más comprado). */
export async function topOpcionesParaCliente(idcliente: number, topN = 3) {
  const prods = await prisma.productos.findMany({
    where: { activo: true, stock: { gt: 0 } },
    select: {
      idproducto: true, nombre: true, sku: true, medida: true, categoria: true,
      precioventa: true, stock: true, duracionestimadodias: true,
    },
  });
  if (!prods.length) return [];

  const ventas = await prisma.ventas.findMany({
    where: { idcliente },
    orderBy: { fecha: 'desc' },
    select: { idventa: true, fecha: true },
  });
  const vIds = ventas.map(v => v.idventa);
  const fechaByVenta = new Map(ventas.map(v => [v.idventa, v.fecha]));
  const lastByProduct = new Map<number, Date>();
  let topProductId: number | undefined;

  if (vIds.length) {
    const det = await prisma.ventas_detalle.findMany({
      where: { idventa: { in: vIds } },
      orderBy: { iddetalle: 'desc' },
      select: { idproducto: true, idventa: true },
    });
    for (const d of det) {
      if (!lastByProduct.has(d.idproducto)) {
        const f = fechaByVenta.get(d.idventa);
        if (f) lastByProduct.set(d.idproducto, f);
      }
    }
    const g = await prisma.ventas_detalle.groupBy({
      by: ['idproducto'],
      where: { idventa: { in: vIds } },
      _sum: { cantidad: true },
    });
    g.sort((a, b) => Number(b._sum.cantidad ?? 0) - Number(a._sum.cantidad ?? 0));
    topProductId = g[0]?.idproducto;
  }

  const now = new Date();
  const ranked = prods.map(p => {
    let score = 0;
    const why: string[] = [];

    const last = lastByProduct.get(p.idproducto);
    const ciclo = p.duracionestimadodias ? Number(p.duracionestimadodias) : null;
    if (last && ciclo) {
      const since = daysBetween(last, now);
      const progress = since / ciclo;
      if (progress >= 0.8) { score += 0.4; why.push('ya toca reponer según tu ciclo'); }
      else if (progress >= 0.5) { score += 0.2; why.push('próximo a reposición'); }
    }

    if (topProductId && p.idproducto === topProductId) {
      score += 0.35; // asegura que aparezca arriba
      why.push('tu producto más comprado');
    }

    score += 0.01 * clamp01((p.stock ?? 0) / 100);

    return {
      idproducto: p.idproducto,
      nombre: p.nombre, sku: p.sku ?? null, medida: p.medida ?? null,
      categoria: p.categoria ?? null, precioventa: p.precioventa ?? null,
      stock: p.stock ?? null,
      score: Math.round(score * 100) / 100,
      razon: why.join('; ') || 'buena afinidad con tu historial',
    };
  });

  ranked.sort((a, b) => b.score - a.score);

  if (topProductId && !ranked.some(r => r.idproducto === topProductId)) {
    const fav = prods.find(x => x.idproducto === topProductId);
    if (fav) {
      ranked.push({
        idproducto: fav.idproducto, nombre: fav.nombre, sku: fav.sku ?? null,
        medida: fav.medida ?? null, categoria: fav.categoria ?? null,
        precioventa: fav.precioventa ?? null, stock: fav.stock ?? null,
        score: 1, razon: 'tu producto más comprado',
      });
    }
  }

  return ranked.sort((a, b) => b.score - a.score).slice(0, topN);
}

/** Mensaje sugerido (OpenAI opcional). */
export async function mensajeSugerido(
  cliente: { nombre?: string|null },
  opciones: Array<{ nombre: string; sku?: string|null; medida?: string|null }>
) {
  if (!openai) {
    const lines = opciones.map(o => `• ${o.nombre}${o.medida ? ' ' + o.medida : ''}${o.sku ? ` (SKU: ${o.sku})` : ''}`).join('\n');
    return `Hola ${cliente.nombre ?? '¿cómo estás?'}\nTe dejo estas opciones que podrían interesarte:\n\n${lines}\n\n¿Querés que te separe alguno o te envío fotos y precio?`;
  }

  const prompt = `
Eres un asistente de ventas amable y breve. Redacta un solo párrafo dirigéndote a "${cliente.nombre ?? 'cliente'}"
y sugiere amablemente 3 opciones de perfume con un tono cercano. Incluye bullets con el nombre, medida y SKU.
Cierra con una pregunta de acción (separar / enviar fotos y precio). No inventes datos: usa exactamente los productos entregados a continuación:

${opciones.map((o,i)=>`- Opción ${i+1}: ${o.nombre}${o.medida ? ' '+o.medida : ''}${o.sku ? ' (SKU: '+o.sku+')' : ''}`).join('\n')}
`;
  const r = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.6,
  });
  return r.choices?.[0]?.message?.content?.trim()
    || `Hola ${cliente.nombre ?? '¿cómo estás?'}.\nTe comparto estas opciones:\n${opciones.map(o=>'• '+o.nombre).join('\n')}`;
}

/** Crea recomendación + detalles en DB y devuelve payload. */
export async function crearRecomendacion(idcliente: number, topN = 3) {
  const cli = await prisma.clientes.findUnique({
    where: { idcliente },
    select: { idcliente: true, nombre: true, apellido: true, telefono: true, email: true },
  });
  if (!cli) throw new Error('Cliente no encontrado');

  const opciones = await topOpcionesParaCliente(idcliente, topN);
  if (!opciones.length) throw new Error('No hay productos elegibles');

  const texto = await mensajeSugerido(
    { nombre: fullName(cli) },
    opciones.map(o => ({ nombre: o.nombre, sku: o.sku, medida: o.medida })),
  );

  const hoy = toDateOnlyUTC(todayLocalISO())!;
  const cab = await prisma.$transaction(async (tx) => {
    const rec = await tx.recomendaciones.create({
      data: {
        fechageneracion: hoy,
        estado: 'pendiente',
        next_action_at: hoy,
        justificacion: texto,
        idcliente,
      },
      select: { idrecomendacion: true },
    });

    await tx.recomendaciones_detalle.createMany({
      data: opciones.map((o, i) => ({
        idrecomendacion: rec.idrecomendacion,
        idproducto: o.idproducto,
        prioridad: i + 1,
        score: Number(o.score ?? 0),
        razon: o.razon,
      })),
    });

    return rec;
  });

  // respuesta enriquecida
  const rec = await prisma.recomendaciones.findUnique({
    where: { idrecomendacion: cab.idrecomendacion },
    select: {
      idrecomendacion: true, fechageneracion: true, estado: true, next_action_at: true, justificacion: true,
      clientes: { select: { idcliente: true, nombre: true, apellido: true, telefono: true, email: true } },
      recomendaciones_detalle: {
        orderBy: { prioridad: 'asc' },
        select: {
          prioridad: true, score: true, razon: true,
          productos: { select: { idproducto: true, nombre: true, sku: true, medida: true, categoria: true, precioventa: true, stock: true } },
        },
      },
    },
  });

  return rec!;
}
