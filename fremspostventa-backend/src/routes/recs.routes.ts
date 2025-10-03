// src/routes/recs.routes.ts
import { Router } from 'express';
import prisma from '../prisma';
import {
  refreshCandidatesMV,
  crearRecomendacion,
} from '../services/recs.service';
import { enviarAlertaVendedores } from '../services/mailer';

export const recsRouter = Router();

/** GET /api/recs/candidates?idcliente= */
recsRouter.get('/candidates', async (req, res) => {
  try {
    const idc = req.query.idcliente ? Number(req.query.idcliente) : undefined;
    const rows: Array<{ idcliente: number; reason: string }> = await prisma.$queryRawUnsafe(
      `SELECT idcliente, reason FROM rec_candidates_daily ${idc ? 'WHERE idcliente = $1' : ''}`,
      ...(idc ? [idc] : []),
    );
    res.json({ ok: true, items: rows });
  } catch (e) { console.error(e); res.status(500).json({ ok:false, message:'Error leyendo candidatos' }); }
});

/** POST /api/recs/refresh */
recsRouter.post('/refresh', async (_req, res) => {
  try { await refreshCandidatesMV(); res.json({ ok:true }); }
  catch (e) { console.error(e); res.status(500).json({ ok:false, message:'Error refrescando MV' }); }
});

/** POST /api/recs/generate  { idcliente, top_n?, alert_vendedores? } */
recsRouter.post('/generate', async (req, res) => {
  try {
    const idcliente = Number(req.body?.idcliente);
    const topN = Math.max(1, Math.min(5, Number(req.body?.top_n ?? 3)));
    const alertVend = Boolean(req.body?.alert_vendedores);

    if (!Number.isFinite(idcliente) || idcliente <= 0) {
      return res.status(400).json({ ok:false, message:'idcliente inválido' });
    }

    const rec = await crearRecomendacion(idcliente, topN);

    if (alertVend) {
      await enviarAlertaVendedores({
        recId: rec.idrecomendacion,
        clienteNombre: `${rec.clientes?.nombre ?? ''} ${rec.clientes?.apellido ?? ''}`.trim() || 'Cliente',
        preview: (rec.justificacion ?? '').slice(0, 200),
        opciones: rec.recomendaciones_detalle.map(d => ({
          nombre: d.productos?.nombre ?? '—',
          sku: d.productos?.sku ?? null,
          medida: d.productos?.medida ?? null,
        })),
      });
    }

    res.json({ ok:true, rec });
  } catch (e:any) {
    console.error(e);
    res.status(500).json({ ok:false, message: e?.message || 'Error generando recomendación' });
  }
});

/** GET /api/recs/:id */
recsRouter.get('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ ok:false, message:'ID inválido' });

    const rec = await prisma.recomendaciones.findUnique({
      where: { idrecomendacion: id },
      select: {
        idrecomendacion: true, fechageneracion: true, estado: true, next_action_at: true, justificacion: true,
        clientes: { select: { idcliente: true, nombre: true, apellido: true, telefono: true, email: true } },
        recomendaciones_detalle: {
          orderBy: { prioridad: 'asc' },
          select: { prioridad: true, score: true, razon: true,
            productos: { select: { idproducto:true, nombre:true, sku:true, medida:true, categoria:true, precioventa:true, stock:true } },
          },
        },
      },
    });
    if (!rec) return res.status(404).json({ ok:false, message:'No encontrada' });
    res.json({ ok:true, rec });
  } catch (e) { console.error(e); res.status(500).json({ ok:false, message:'Error obteniendo recomendación' }); }
});

/** POST /api/recs/:id/defer { days } */
recsRouter.post('/:id/defer', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const days = Math.max(1, Number(req.body?.days ?? 1));
    const base = new Date(); base.setUTCHours(0,0,0,0);
    const next = new Date(base.getTime() + days*86400000);

    const upd = await prisma.recomendaciones.update({
      where: { idrecomendacion: id },
      data: { next_action_at: next },
      select: { idrecomendacion:true, next_action_at:true },
    });
    res.json({ ok:true, id:upd.idrecomendacion, next_action_at: upd.next_action_at });
  } catch (e) { console.error(e); res.status(500).json({ ok:false, message:'Error posponiendo' }); }
});

/** POST /api/recs/:id/discard */
recsRouter.post('/:id/discard', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const upd = await prisma.recomendaciones.update({
      where: { idrecomendacion: id }, data: { estado: 'descartada' },
      select: { idrecomendacion:true, estado:true },
    });
    res.json({ ok:true, id:upd.idrecomendacion, estado:upd.estado });
  } catch (e) { console.error(e); res.status(500).json({ ok:false, message:'Error descartando' }); }
});
