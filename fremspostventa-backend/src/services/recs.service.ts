import prisma from '../prisma';
import OpenAI from 'openai';
import 'dotenv/config';

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

/* -------------------- OpenAI opcional -------------------- */
const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

/* -------------------- MV candidatos -------------------- */
export async function refreshCandidatesMV() {
  await prisma.$executeRawUnsafe('REFRESH MATERIALIZED VIEW rec_candidates_daily;');
}

/* -------------------- Razones MV -> App -------------------- */
type ReasonMV  = 'cycle' | 'dormant' | 'no_purchases';
export type ReasonApp = 'cycle_due' | 'lapsed' | 'no_purchases' | 'seasonal' | 'generic' | 'no_purchases_old';

function normalizeReason(r: string): ReasonApp {
  const k = (r || '').toLowerCase();
  if (k === 'cycle')        return 'cycle_due';
  if (k === 'dormant')      return 'lapsed';
  if (k === 'no_purchases') return 'no_purchases';
  if (k === 'no_purchases_old') return 'no_purchases_old';
  return 'generic';
}

/** Elige la razón principal para un cliente según la MV (prioridad: cycle > dormant > no_purchases). */
async function getCandidateReason(idcliente: number): Promise<ReasonApp> {
  const rows = await prisma.$queryRaw<{ reason: string }[]>`
    SELECT reason FROM rec_candidates_daily WHERE idcliente = ${idcliente}
  `;
  if (!rows?.length) return 'generic';

  const weight: Record<ReasonMV, number> = {
    cycle: 1,
    dormant: 2,
    no_purchases: 3,
  };

  const mvReasons = rows
    .map(r => r.reason?.toLowerCase())
    .filter((r): r is ReasonMV => r === 'cycle' || r === 'dormant' || r === 'no_purchases' || r === 'no_purchases_old');

  mvReasons.sort((a, b) => weight[a] - weight[b]);
  return normalizeReason(mvReasons[0]);
}

/* -------------------- Contexto del cliente -------------------- */
async function buildClienteContext(idcliente: number) {
  const ventas = await prisma.ventas.findMany({
    where: { idcliente },
    orderBy: { fecha: 'desc' },
    select: { idventa: true, fecha: true },
    take: 20,
  });
  const hasHistory = ventas.length > 0;

  let lastDate: Date | null = null;
  let daysSince: number | null = null;
  let fav: { idproducto: number; nombre: string } | null = null;
  let typicalCycle: number | null = null;

  if (hasHistory) {
    lastDate = ventas[0].fecha;
    daysSince = Math.floor((Date.now() - lastDate.getTime()) / 86400000);
    const vIds = ventas.map(v => v.idventa);
    const g = await prisma.ventas_detalle.groupBy({
      by: ['idproducto'],
      where: { idventa: { in: vIds } },
      _sum: { cantidad: true },
      orderBy: { _sum: { cantidad: 'desc' } },
      take: 1,
    });
    const favId = g[0]?.idproducto;
    if (favId) {
      const p = await prisma.productos.findUnique({
        where: { idproducto: favId },
        select: { idproducto: true, nombre: true, duracionestimadodias: true },
      });
      if (p) {
        fav = { idproducto: p.idproducto, nombre: p.nombre };
        typicalCycle = p.duracionestimadodias ? Number(p.duracionestimadodias) : null;
      }
    }
  }

  return { hasHistory, lastDate, daysSince, fav, typicalCycle };
}

/* -------------------- Ranking de opciones TOP-N -------------------- */
export async function topOpcionesParaCliente(idcliente: number, topN = 3) {
  // Productos activos con stock
  const prods = await prisma.productos.findMany({
    where: { activo: true, stock: { gt: 0 } },
    select: {
      idproducto: true, nombre: true, sku: true, medida: true, categoria: true,
      precioventa: true, stock: true, duracionestimadodias: true,
    },
  });
  if (!prods.length) return [];

  // Historial del cliente
  const ventas = await prisma.ventas.findMany({
    where: { idcliente },
    orderBy: { fecha: 'desc' },
    select: { idventa: true, fecha: true },
  });
  const hasHistory = ventas.length > 0;
  const vIds = ventas.map(v => v.idventa);
  const fechaByVenta = new Map(ventas.map(v => [v.idventa, v.fecha]));
  const lastByProduct = new Map<number, Date>();
  let topProductId: number | undefined = undefined;

  if (hasHistory) {
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
      orderBy: { _sum: { cantidad: 'desc' } },
      take: 1,
    });
    topProductId = g[0]?.idproducto;
  }

  // Popularidad global (para clientes sin historial)
  let popScore = new Map<number, number>();
  if (!hasHistory) {
    const best = await prisma.ventas_detalle.groupBy({
      by: ['idproducto'],
      _sum: { cantidad: true },
      orderBy: { _sum: { cantidad: 'desc' } },
      take: 50,
    });
    const max = Math.max(1, ...best.map(b => Number(b._sum.cantidad || 0)));
    best.forEach(b => {
      const s = Number(b._sum.cantidad || 0) / max;   // 0..1
      popScore.set(b.idproducto, s);
    });
  }

  const now = new Date();
  const ranked = prods.map(p => {
    let score = 0;
    const why: string[] = [];

    if (hasHistory) {
      const last = lastByProduct.get(p.idproducto);
      const ciclo = p.duracionestimadodias ? Number(p.duracionestimadodias) : null;
      if (last && ciclo) {
        const since = daysBetween(last, now);
        const progress = since / ciclo;
        if (progress >= 0.8) { score += 0.4; why.push('ya toca reponer según tu ciclo'); }
        else if (progress >= 0.5) { score += 0.2; why.push('próximo a reposición'); }
      }
      if (topProductId && p.idproducto === topProductId) {
        score += 0.35;
        why.push('tu producto más comprado');
      }
    } else {
      const pop = popScore.get(p.idproducto) ?? 0;
      if (pop > 0) { score += 0.4 * pop; why.push('popular entre nuestros clientes'); }
      else { score += 0.1; why.push('sugerencia inicial'); }
    }

    // Pequeño plus por stock
    score += 0.01 * clamp01((p.stock ?? 0) / 100);

    return {
      idproducto: p.idproducto,
      nombre: p.nombre, sku: p.sku ?? null, medida: p.medida ?? null,
      categoria: p.categoria ?? null, precioventa: p.precioventa ?? null,
      stock: p.stock ?? null,
      score: Math.round(score * 100) / 100,
      razon: (why.join('; ') || (hasHistory ? 'reposición sugerida' : 'sugerencia inicial')),
    };
  });

  ranked.sort((a, b) => b.score - a.score);

  // Seguridad: si hay favorito y no entró, lo empujamos arriba (igual SÓLO devolvemos topN)
  if (hasHistory && topProductId && !ranked.some(r => r.idproducto === topProductId)) {
    const fav = prods.find(x => x.idproducto === topProductId);
    if (fav) {
      ranked.unshift({
        idproducto: fav.idproducto, nombre: fav.nombre, sku: fav.sku ?? null,
        medida: fav.medida ?? null, categoria: fav.categoria ?? null,
        precioventa: fav.precioventa ?? null, stock: fav.stock ?? null,
        score: 1, razon: 'tu producto más comprado',
      });
    }
  }

  return ranked.slice(0, topN);
}

/* -------------------- Mensaje sugerido (OpenAI opcional) -------------------- */
export async function mensajeSugerido(
  cliente: { nombre?: string|null },
  opciones: Array<{ nombre: string; sku?: string|null; medida?: string|null; razon?: string|null }>,
  ctx: { hasHistory: boolean; reason: ReasonApp; daysSince?: number|null; typicalCycle?: number|null }
) {
  const nombre = cliente.nombre ?? '¿cómo estás?';
  const bullets = opciones.map(o =>
    `• ${o.nombre}${o.medida ? ' ' + o.medida : ''}${o.sku ? ` (SKU: ${o.sku})` : ''}${o.razon ? ` — ${o.razon}` : ''}`
  ).join('\n');
  const tono = ['cercano y natural (vos)', 'amable y profesional', 'dinámico/entusiasta'][Math.floor(Math.random()*3)];

  // Sin OpenAI => copies específicos por escenario
  if (!openai) {
    const cab = (() => {
      switch (ctx.reason) {
        case 'no_purchases': return `Hola ${nombre}\nAún no registramos compras tuyas, así que te dejo unas sugerencias iniciales:`;
        case 'no_purchases_old': return `Hola ${nombre}\nHace rato que no pasabas, aún no registramos compras tuyas, así que te dejo unas sugerencias iniciales:`;
        case 'cycle_due':    return `Hola ${nombre}\nSegún tu frecuencia de compra, ya toca reponer. Mirá estas opciones:`;
        case 'lapsed':       return `Hola ${nombre}\nHace rato que no pasabas. Quizá te interesen estas opciones:`;
        case 'seasonal':     return `Hola ${nombre}\nSe acercan fechas ideales para regalarte/regalar. Te sugiero:`;
        default:             return `Hola ${nombre}\nPensé que estas opciones podrían servirte:`;
      }
    })();
    return `${cab}\n\n${bullets}\n\n¿Quieres que te separe alguno o te envío fotos y precio?`;
  }

  // Con OpenAI
  const contexto = [
    `Escenario: ${ctx.reason}`,
    ctx.hasHistory ? 'Cliente CON historial' : 'Cliente SIN historial',
    ctx.daysSince != null ? `Días desde última compra: ${ctx.daysSince}` : '',
    ctx.typicalCycle != null ? `Ciclo estimado: ~${ctx.typicalCycle} días` : '',
  ].filter(Boolean).join(' | ');

  const prompt = `
Escribe en español un único mensaje breve (4–6 líneas), tono ${tono}, usando "tu".
${contexto}

Instrucciones:
- Personaliza la primera línea acorde al escenario.
- Presenta las opciones como bullets, sin inventar datos. Incluye nombre, medida y SKU EXACTOS. Si hay "razon", añadí una frase corta.
- Cierra con un llamado a la acción (separar / enviar fotos y precio).
- Varía el wording en cada generación.

Opciones:
${opciones.map((o,i)=>`- Opción ${i+1}: ${o.nombre}${o.medida?' '+o.medida:''}${o.sku?' (SKU: '+o.sku+')':''}${o.razon? ' | razón: '+o.razon:''}`).join('\n')}

Nombre del cliente: ${nombre}
`;

  const r = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    temperature: 0.8,
    messages: [{ role: 'user', content: prompt }],
  });

  return r.choices?.[0]?.message?.content?.trim()
    || `Hola ${nombre}\nTe comparto estas opciones:\n\n${bullets}\n\n¿Quieres que te separe alguno o te envío fotos y precio?`;
}

/* -------------------- Crear recomendación (persistencia) -------------------- */
export async function crearRecomendacion(idcliente: number, topN = 3) {
  const cli = await prisma.clientes.findUnique({
    where: { idcliente },
    select: { idcliente: true, nombre: true, apellido: true, telefono: true, email: true },
  });
  if (!cli) throw new Error('Cliente no encontrado');

  const ctx = await buildClienteContext(idcliente);
  const reason = await getCandidateReason(idcliente);

  // topN ya acotado
  const opciones = await topOpcionesParaCliente(idcliente, topN);
  if (!opciones.length) throw new Error('No hay productos elegibles');

  const texto = await mensajeSugerido(
    { nombre: fullName(cli) },
    opciones.map(o => ({ nombre: o.nombre, sku: o.sku, medida: o.medida, razon: o.razon })),
    { hasHistory: ctx.hasHistory, reason, daysSince: ctx.daysSince, typicalCycle: ctx.typicalCycle }
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
        razon: o.razon || (ctx.hasHistory ? 'reposición sugerida' : 'sugerencia inicial'),
      })),
    });

    return rec;
  });

  // Respuesta enriquecida
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
