import { Request, Response } from 'express';
import prisma from '../prisma';

const asDate = (s?: string) => `${s} 00:00:00`;

export async function sales(req: Request, res: Response) {
  const { from, to } = req.query as any;

  const [kpis] = await prisma.$queryRaw<any[]>`
    SELECT 
      COALESCE(SUM(v.total),0)::numeric AS "totalSales",
      COUNT(v.idventa)::int            AS orders,
      CASE WHEN COUNT(v.idventa)=0 THEN 0 ELSE (SUM(v.total)/COUNT(v.idventa)) END::numeric AS "avgTicket"
    FROM ventas v
    WHERE v.fecha >= ${from}::date AND v.fecha <= ${to}::date
  `;

  const rows = await prisma.$queryRaw<any[]>`
    SELECT to_char(v.fecha,'YYYY-MM-DD') AS date,
           COUNT(v.idventa)::int AS orders,
           COALESCE(SUM(v.total),0)::numeric AS total
    FROM ventas v
    WHERE v.fecha >= ${from}::date AND v.fecha <= ${to}::date
    GROUP BY v.fecha
    ORDER BY v.fecha
  `;

  res.json({ kpis, trend: rows, rows });
}

export async function salesByCustomer(req: Request, res: Response) {
  const { from, to } = req.query as any;

  const [kpis] = await prisma.$queryRaw<any[]>`
    WITH inrange AS (
      SELECT * FROM ventas v
      WHERE v.fecha >= ${from}::date AND v.fecha <= ${to}::date
    ),
    active_customers AS (SELECT DISTINCT idcliente FROM inrange WHERE idcliente IS NOT NULL),
    historical_customers AS (SELECT DISTINCT idcliente FROM ventas WHERE idcliente IS NOT NULL)
    SELECT
      (SELECT COUNT(*) FROM clientes c
        WHERE c.fechaingreso >= ${from}::date AND c.fechaingreso <= ${to}::date)::int AS "newCustomers",
      CASE WHEN (SELECT COUNT(*) FROM historical_customers)=0 THEN 0
           ELSE (SELECT COUNT(*) FROM active_customers)::numeric / (SELECT COUNT(*) FROM historical_customers) END AS "activePct",
      CASE WHEN (SELECT COUNT(*) FROM active_customers)=0 THEN 0
           ELSE (SELECT COALESCE(SUM(total),0) FROM inrange)::numeric / (SELECT COUNT(*) FROM active_customers) END AS "avgTicketPerCustomer"
  `;

  const rows = await prisma.$queryRaw<any[]>`
    SELECT (c.nombre || ' ' || c.apellido) AS cliente,
           COUNT(v.idventa)::int AS compras,
           COALESCE(SUM(v.total),0)::numeric AS total,
           to_char(MAX(v.fecha),'YYYY-MM-DD') AS last
    FROM ventas v
    JOIN clientes c ON c.idcliente = v.idcliente
    WHERE v.fecha >= ${from}::date AND v.fecha <= ${to}::date
    GROUP BY c.idcliente, c.nombre, c.apellido
    ORDER BY total DESC, cliente ASC
  `;

  res.json({ kpis, rows });
}

export async function topProducts(req: Request, res: Response) {
  const { from, to, topN = '10' } = req.query as any;
  const n = Number(topN) || 10;

  const all = await prisma.$queryRaw<any[]>`
    SELECT p.nombre AS producto,
           COALESCE(SUM(vd.cantidad),0)::int AS qty,
           COALESCE(SUM(vd.subtotal_linea),0)::numeric AS amount
    FROM ventas_detalle vd
    JOIN ventas v    ON v.idventa = vd.idventa
    JOIN productos p ON p.idproducto = vd.idproducto
    WHERE v.fecha >= ${from}::date AND v.fecha <= ${to}::date
    GROUP BY p.idproducto, p.nombre
    ORDER BY amount DESC
  `;

  const top = all.slice(0, n);
  const totalAmount = all.reduce((a,b)=> a + Number(b.amount), 0);
  const topAmount   = top.reduce((a,b)=> a + Number(b.amount), 0);
  const kpis = { skuSold: all.length, topN: n, topParticipation: totalAmount ? topAmount/totalAmount : 0 };

  res.json({ kpis, trend: top, rows: top });
}

export async function aiRecs(req: Request, res: Response) {
  const { from, to } = req.query as any;

  const [k] = await prisma.$queryRaw<any[]>`
    SELECT
      COUNT(*)::int                                        AS generated,
      COUNT(*) FILTER (WHERE r.estado IN ('contactada','enviada'))::int AS contacted,
      CASE WHEN COUNT(*) FILTER (WHERE r.estado IN ('contactada','convertida', 'enviada'))=0 THEN 0
           ELSE COUNT(*) FILTER (WHERE r.estado = 'convertida')::numeric
                / COUNT(*) FILTER (WHERE r.estado IN ('contactada','convertida', 'enviada')) END AS conversion
    FROM recomendaciones r
    WHERE r.fechageneracion >= ${from}::date
      AND r.fechageneracion <= ${to}::date
  `;

  const rows = await prisma.$queryRaw<any[]>`
    SELECT to_char(date_trunc('day', r.fechageneracion), 'YYYY-MM-DD') AS date,
           COUNT(*)::int AS generated,
           COUNT(*) FILTER (WHERE r.estado IN ('contactada','enviada'))::int AS contacted,
           COUNT(*) FILTER (WHERE r.estado = 'descartada')::int AS discarded
    FROM recomendaciones r
    WHERE r.fechageneracion >= ${from}::date
      AND r.fechageneracion <= ${to}::date
    GROUP BY 1
    ORDER BY 1
  `;

  res.json({ kpis: k, trend: rows, rows });
}
