// src/routes/recs.routes.ts
import { Router } from 'express';
import prisma from '../prisma';
import { logActivity } from '../services/activity';
import {
  refreshCandidatesMV,
  crearRecomendacion,
} from '../services/recs.service';
import { enviarAlertaVendedores } from '../services/mailer';

export const recsRouter = Router();

recsRouter.get('/', async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page ?? 1));
    const size = Math.min(50, Math.max(1, Number(req.query.size ?? 10)));
    const estado = String(req.query.estado ?? 'all').toLowerCase(); // pendiente|enviada|descartada|all
    const due = String(req.query.due ?? 'all').toLowerCase();    // overdue|today|upcoming|all
    const search = String(req.query.search ?? '').trim();

    const where: any = {};

    // estado
    if (['pendiente', 'enviada', 'descartada', 'vencida'].includes(estado)) {
      where.estado = estado;
    }

    // --- cálculo de día UTC sin helper ---
    const now = new Date();
    const todayStart = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())); // 00:00Z
    const tomorrowStart = new Date(todayStart.getTime() + 86400000);                          // +1 día

    // due (solo para pendientes)
    if ((estado === 'pendiente' || estado === 'all') && ['overdue', 'today', 'upcoming'].includes(due)) {
      where.estado = 'pendiente';
      if (due === 'overdue') where.next_action_at = { lt: todayStart };
      if (due === 'today') where.next_action_at = { gte: todayStart, lt: tomorrowStart };
      if (due === 'upcoming') where.next_action_at = { gte: tomorrowStart };
    }

    // search por cliente
    if (search) {
      where.clientes = {
        OR: [
          { nombre: { contains: search, mode: 'insensitive' } },
          { apellido: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { telefono: { contains: search } },
        ],
      };
    }

    const total = await prisma.recomendaciones.count({ where });

    const rows = await prisma.recomendaciones.findMany({
      where,
      skip: (page - 1) * size,
      take: size,
      orderBy: [
        { estado: 'asc' },        // pendientes primero
        { next_action_at: 'asc' },
        { idrecomendacion: 'desc' },
      ],
      select: {
        idrecomendacion: true,
        fechageneracion: true,
        next_action_at: true,
        estado: true,
        justificacion: true,
        clientes: { select: { idcliente: true, nombre: true, apellido: true, telefono: true, email: true } },
        recomendaciones_detalle: {
          orderBy: { prioridad: 'asc' },
          take: 3,
          select: { prioridad: true, productos: { select: { idproducto: true, nombre: true, sku: true, medida: true } } },
        },
      },
    });

    const items = rows.map(r => ({
      id: r.idrecomendacion,
      fecha: r.fechageneracion,
      next_action_at: r.next_action_at,
      estado: r.estado,
      cliente: {
        id: r.clientes?.idcliente ?? null,
        nombre: `${r.clientes?.nombre ?? ''} ${r.clientes?.apellido ?? ''}`.trim(),
        telefono: r.clientes?.telefono ?? null,
        email: r.clientes?.email ?? null,
      },
      preview: (r.justificacion ?? '').slice(0, 160),
      opciones: r.recomendaciones_detalle.map(d => ({
        nombre: d.productos?.nombre ?? '—',
        sku: d.productos?.sku ?? null,
        medida: d.productos?.medida ?? null,
      })),
    }));

    res.json({ ok: true, page, size, total, items });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, message: 'Error listando recomendaciones' });
  }
});

/** GET /api/recs/candidates?idcliente= */
recsRouter.get('/candidates', async (req, res) => {
  try {
    const idc = req.query.idcliente ? Number(req.query.idcliente) : undefined;
    let rows: Array<{ idcliente: number; reason: string }> = [];
    if (idc && Number.isFinite(idc)) {
      rows = await prisma.$queryRaw<{ idcliente: number; reason: string }[]>`
        SELECT idcliente, reason FROM rec_candidates_daily WHERE idcliente = ${idc}
      `;
    } else {
      rows = await prisma.$queryRaw<{ idcliente: number; reason: string }[]>`
        SELECT idcliente, reason FROM rec_candidates_daily
      `;
    }
    res.json({ ok: true, items: rows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, message: 'Error leyendo candidatos' });
  }
});

/** POST /api/recs/refresh */
recsRouter.post('/refresh', async (_req, res) => {
  try { await refreshCandidatesMV(); res.json({ ok: true }); }
  catch (e) { console.error(e); res.status(500).json({ ok: false, message: 'Error refrescando MV' }); }
});

/** POST /api/recs/generate  { idcliente, top_n?, alert_vendedores? } */
recsRouter.post('/generate', async (req, res) => {
  try {
    const idcliente = Number(req.body?.idcliente);
    const topN = Math.max(1, Math.min(5, Number(req.body?.top_n ?? 3)));
    const alertVend = Boolean(req.body?.alert_vendedores);

    if (!Number.isFinite(idcliente) || idcliente <= 0) {
      return res.status(400).json({ ok: false, message: 'idcliente inválido' });
    }

    // 1) Genera la recomendación
    const rec = await crearRecomendacion(idcliente, topN);

    // 2) Responde YA
    res.json({ ok: true, rec });

    // 3) No bloquear: log + correo
    setImmediate(async () => {
      try {
        const clienteNombre =
          (`${rec?.clientes?.nombre ?? ''} ${rec?.clientes?.apellido ?? ''}`.trim()) || 'Cliente';

        try {
          await logActivity({
            who_user_id: (req as any)?.user?.idusuario ?? null,
            what: `Recomendación #${rec.idrecomendacion} generada para ${clienteNombre}`,
            type: 'recomendacion',
            meta: { idrecomendacion: rec.idrecomendacion, topN, reason: 'manual/cron' }
          });
        } catch (e) {
          console.warn('[actividad] no se pudo registrar generación de recomendación:', (e as any)?.message || e);
        }

        if (alertVend) {
          try {
            const preview = String(rec?.justificacion ?? '').slice(0, 600);
            const opciones = (rec?.recomendaciones_detalle ?? []).slice(0, topN).map((d: any) => ({
              nombre: d?.productos?.nombre ?? '—',
              sku: d?.productos?.sku ?? null,
              medida: d?.productos?.medida ?? null,
            }));
            const resp = await enviarAlertaVendedores({
              recId: Number(rec?.idrecomendacion),
              clienteNombre,
              preview,
              opciones,
            });
            if (!resp?.ok) console.warn('[mailer] alerta vendedores omitida (transporter off o sin destinatarios)');
            else console.log('[mailer] alerta vendedores enviada messageId=', resp.messageId);
          } catch (err) {
            console.error('[mailer] envío alerta vendedores falló', err);
          }
        }
      } catch (e) {
        console.error('[generate post-send]', e);
      }
    });

  } catch (e: any) {
    console.error(e);
    res.status(500).json({ ok: false, message: e?.message || 'Error generando recomendación' });
  }
});

/** GET /api/recs/:id */
recsRouter.get('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ ok: false, message: 'ID inválido' });

    const rec = await prisma.recomendaciones.findUnique({
      where: { idrecomendacion: id },
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
    if (!rec) return res.status(404).json({ ok: false, message: 'No encontrada' });
    res.json({ ok: true, rec });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, message: 'Error obteniendo recomendación' });
  }
});

/** POST /api/recs/:id/defer { days } */
recsRouter.post('/:id/defer', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const days = Math.max(1, Number(req.body?.days ?? 1));
    const base = new Date(); base.setUTCHours(0, 0, 0, 0);
    const next = new Date(base.getTime() + days * 86400000);

    const upd = await prisma.recomendaciones.update({
      where: { idrecomendacion: id },
      data: { next_action_at: next },
      select: {
        idrecomendacion: true,
        next_action_at: true,
        clientes: { select: { nombre: true, apellido: true } }
      },
    });

    try {
      const clienteNombre = [upd.clientes?.nombre, upd.clientes?.apellido].filter(Boolean).join(' ').trim() || 'Cliente';
      await logActivity({
        who_user_id: (req as any)?.user?.idusuario ?? null,
        what: `Recomendación #${id} pospuesta ${days} día(s) para ${clienteNombre}`,
        type: 'recomendacion',
        meta: { idrecomendacion: id, days, next_action_at: upd.next_action_at }
      });
    } catch (e) {
      console.warn('[actividad] no se pudo registrar defer:', (e as any)?.message || e);
    }

    res.json({ ok: true, id: upd.idrecomendacion, next_action_at: upd.next_action_at });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, message: 'Error posponiendo' });
  }
});

/** POST /api/recs/:id/discard */
recsRouter.post('/:id/discard', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const upd = await prisma.recomendaciones.update({
      where: { idrecomendacion: id },
      data: { estado: 'descartada', next_action_at: null },
      select: {
        idrecomendacion: true,
        estado: true,
        clientes: { select: { nombre: true, apellido: true } }
      },
    });

    try {
      const clienteNombre = [upd.clientes?.nombre, upd.clientes?.apellido].filter(Boolean).join(' ').trim() || 'Cliente';
      await logActivity({
        who_user_id: (req as any)?.user?.idusuario ?? null,
        what: `Recomendación #${id} descartada para ${clienteNombre}`,
        type: 'recomendacion',
        meta: { idrecomendacion: id }
      });
    } catch (e) {
      console.warn('[actividad] no se pudo registrar discard:', (e as any)?.message || e);
    }

    res.json({ ok: true, id: upd.idrecomendacion, estado: upd.estado });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, message: 'Error descartando' });
  }
});

/** POST /api/recs/:id/sent */
recsRouter.post('/:id/sent', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const upd = await prisma.recomendaciones.update({
      where: { idrecomendacion: id },
      data: { estado: 'enviada', next_action_at: null },
      select: {
        idrecomendacion: true,
        estado: true,
        next_action_at: true,
        clientes: { select: { nombre: true, apellido: true } }
      },
    });

    try {
      const clienteNombre = [upd.clientes?.nombre, upd.clientes?.apellido].filter(Boolean).join(' ').trim() || 'Cliente';
      await logActivity({
        who_user_id: (req as any)?.user?.idusuario ?? null,
        what: `Recomendación #${id} marcada como enviada a ${clienteNombre}`,
        type: 'recomendacion',
        meta: { idrecomendacion: id }
      });
    } catch (e) {
      console.warn('[actividad] no se pudo registrar sent:', (e as any)?.message || e);
    }
    
    res.json({ ok: true, id: upd.idrecomendacion, estado: upd.estado, next_action_at: upd.next_action_at });
  } catch (err) {
    console.error('[POST /api/recs/:id/sent] error', err);
    res.status(500).json({ ok: false, error: 'mark_sent_failed' });
  }
});
