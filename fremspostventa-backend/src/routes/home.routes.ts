import { Router } from 'express';
import prisma from '../prisma';

export const homeRouter = Router();

/** KPIs para el dashboard */
homeRouter.get('/kpis', async (_req, res) => {
  try {
    // Ventas HOY / AYER: compara contra CURRENT_DATE (independiente de tz)
    const [ventasHoyRow]  = await prisma.$queryRaw<{ count: number }[]>`
      SELECT COUNT(*)::int AS count
      FROM ventas
      WHERE fecha = CURRENT_DATE
    `;
    const [ventasAyerRow] = await prisma.$queryRaw<{ count: number }[]>`
      SELECT COUNT(*)::int AS count
      FROM ventas
      WHERE fecha = CURRENT_DATE - INTERVAL '1 day'
    `;
    const ventasHoy  = ventasHoyRow?.count  ?? 0;
    const ventasAyer = ventasAyerRow?.count ?? 0;

    let ventasTrend = '—';
    if (ventasAyer === 0 && ventasHoy > 0) ventasTrend = '+100%';
    else if (ventasAyer > 0) {
      const pct = Math.round(((ventasHoy - ventasAyer) / ventasAyer) * 100);
      ventasTrend = `${pct >= 0 ? '+' : ''}${pct}%`;
    }

    // Clientes activos (últimos 180 días) por fecha DATE
    const [activosRow] = await prisma.$queryRaw<{ count: number }[]>`
      SELECT COUNT(DISTINCT idcliente)::int AS count
      FROM ventas
      WHERE fecha >= CURRENT_DATE - INTERVAL '180 days'
        AND idcliente IS NOT NULL
    `;
    const clientesActivos = activosRow?.count ?? 0;

    // Alertas pendientes: esto sí con Prisma normal
    const alertasPendientes = await prisma.recomendaciones.count({
      where: { estado: 'pendiente' },
    });

    res.json({
      ok: true,
      kpis: {
        ventasHoy,
        ventasTrend,
        clientesActivos,
        alertasPendientes,
      },
    });
  } catch (e: any) {
    console.error('[home/kpis]', e);
    res.status(500).json({ ok: false, message: e?.message || 'Error KPIs' });
  }
});

/** Actividad reciente (últimos N ítems) */
homeRouter.get('/activity', async (req, res) => {
  try {
    const limit = Math.min(5, Math.max(1, Number(req.query.limit ?? 5)));
    const rows = await prisma.actividad.findMany({
      orderBy: { created_at: 'desc' },
      take: limit,
      select: {
        id: true,
        created_at: true,
        what: true,
        type: true,
        usuarios: { select: { idusuario: true, nombre: true, apellido: true } },
      },
    });
    const items = rows.map(r => ({
      id: r.id,
      when: r.created_at,
      what: r.what,
      type: r.type,
      who: [r.usuarios?.nombre, r.usuarios?.apellido].filter(Boolean).join(' ') || 'Sistema',
    }));
    res.json({ ok: true, items });
  } catch (e: any) {
    console.error('[home/activity]', e);
    res.status(500).json({ ok: false, message: e?.message || 'Error actividad' });
  }
});

homeRouter.get('/top-products', async (req, res) => {
  try {
    const days  = Math.max(1, Math.min(365, Number(req.query.days ?? 90)));
    const limit = Math.max(1, Math.min(20, Number(req.query.limit ?? 5)));
    const by    = String(req.query.by ?? 'units').toLowerCase(); // 'units' | 'amount'

    const baseSelect = `
      SELECT
        p.idproducto,
        p.nombre,
        COALESCE(SUM(d.cantidad), 0)::int                 AS unidades,
        COALESCE(SUM(d.subtotal_linea), 0)::numeric(12,2) AS monto
      FROM ventas v
      JOIN ventas_detalle d ON d.idventa = v.idventa
      JOIN productos p      ON p.idproducto = d.idproducto
      WHERE v.fecha >= CURRENT_DATE - (${days}::int * INTERVAL '1 day')
      GROUP BY p.idproducto, p.nombre
    `;

    const sql =
      by === 'amount'
        ? `${baseSelect} ORDER BY monto DESC, unidades DESC LIMIT ${limit}`
        : `${baseSelect} ORDER BY unidades DESC, monto DESC LIMIT ${limit}`;

    const rows = await prisma.$queryRawUnsafe<
      { idproducto:number; nombre:string; unidades:number; monto:number }[]
    >(sql);

    res.json({ ok: true, items: rows });
  } catch (e:any) {
    console.error('[home/top-products]', e);
    res.status(500).json({ ok:false, message: e?.message || 'Error top productos' });
  }
});
