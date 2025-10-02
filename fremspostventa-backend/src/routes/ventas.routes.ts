import { Router } from 'express';
import prisma from '../prisma';

export const ventasRouter = Router();

// === Helpers de fecha (copiados del clientes.routes.ts) ===
function toDateOnlyUTC(s?: string | null): Date | null {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  return new Date(Date.UTC(y, mo - 1, d)); // 00:00Z (igual que clientes)
}
function todayLocalISO(): string {
  const t = new Date();
  const y = t.getFullYear();
  const m = String(t.getMonth() + 1).padStart(2, '0');
  const d = String(t.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function toStr(v: unknown) { return (typeof v === 'string' ? v : '').trim(); }

// ------------------- POST /api/ventas -------------------
ventasRouter.post('/', async (req, res) => {
  try {
    const { fecha, idcliente, idusuario, notas, items } = req.body ?? {};
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ ok: false, message: 'La venta debe tener al menos un producto.' });
    }

    // === FECHA: igual que clientes ===
    const f = toDateOnlyUTC(fecha);
    if (!f) return res.status(400).json({ ok: false, message: 'Fecha inválida (YYYY-MM-DD).' });

    // Normaliza y valida líneas
    const lines = items.map((it: any) => ({
      idproducto: Number(it.idproducto),
      cantidad: Number(it.cantidad),
      precio: Number(it.precio_unit ?? it.precio ?? 0),
      desc_pct: Number(it.desc_pct ?? 0),
    }));

    for (const l of lines) {
      if (!Number.isFinite(l.idproducto) || l.idproducto <= 0)
        return res.status(400).json({ ok: false, message: 'Producto inválido.' });
      if (!Number.isFinite(l.cantidad) || l.cantidad <= 0 || Math.trunc(l.cantidad) !== l.cantidad)
        return res.status(400).json({ ok: false, message: 'Cantidad inválida.' });
      if (!Number.isFinite(l.precio) || l.precio < 0)
        return res.status(400).json({ ok: false, message: 'Precio inválido.' });
      if (l.desc_pct < 0 || l.desc_pct > 100)
        return res.status(400).json({ ok: false, message: 'Descuento inválido.' });
    }

    // Verifica stock disponible
    const prods = await prisma.productos.findMany({
      where: { idproducto: { in: lines.map(l => l.idproducto) } },
      select: { idproducto: true, nombre: true, stock: true, activo: true }
    });
    const byId = new Map(prods.map(p => [p.idproducto, p]));
    for (const l of lines) {
      const p = byId.get(l.idproducto);
      if (!p) return res.status(404).json({ ok: false, message: `Producto ${l.idproducto} no existe.` });
      if (!p.activo) return res.status(400).json({ ok: false, message: `Producto ${p.nombre} está inactivo.` });
      if ((p.stock ?? 0) < l.cantidad)
        return res.status(409).json({ ok: false, message: `Stock insuficiente para ${p.nombre}.` });
    }

    // Cálculos
    const detalles = lines.map(l => {
      const bruto = l.cantidad * l.precio;
      const desc = bruto * (l.desc_pct / 100);
      const neto = bruto - desc;
      return { ...l, subtotal_linea: Number(neto.toFixed(2)) };
    });
    const subtotal = Number(detalles.reduce((a, d) => a + d.cantidad * d.precio, 0).toFixed(2));
    const descuentot = Number((subtotal - detalles.reduce((a, d) => a + d.subtotal_linea, 0)).toFixed(2));
    const total = Number((subtotal - descuentot).toFixed(2));

    // Transacción
    const result = await prisma.$transaction(async (tx) => {
      const venta = await tx.ventas.create({
        data: {
          fecha: f,                        // === FECHA ===
          subtotal, descuentot, total,
          notas: (notas ?? '') || null,
          idcliente: idcliente ? Number(idcliente) : null,
          idusuario: idusuario ? Number(idusuario) : null,
        },
        select: { idventa: true }
      });

      await tx.ventas_detalle.createMany({
        data: detalles.map(d => ({
          idventa: venta.idventa,
          idproducto: d.idproducto,
          cantidad: d.cantidad,
          precio_unit: d.precio,
          desc_pct: d.desc_pct,
          subtotal_linea: d.subtotal_linea
        }))
      });

      for (const d of detalles) {
        await tx.productos.update({
          where: { idproducto: d.idproducto },
          data: { stock: { decrement: d.cantidad } }
        });
      }

      if (idcliente) {
        await tx.clientes.update({
          where: { idcliente: Number(idcliente) },
          data: { ultimacompra: f }       // === FECHA: igual helper ===
        });
      }

      return venta;
    });

    return res.json({ ok: true, idventa: result.idventa, total });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, message: 'Error registrando venta' });
  }
});

// ------------------- GET /api/ventas (listado) -------------------
ventasRouter.get('/', async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page ?? 1));
    const size = Math.max(1, Math.min(100, Number(req.query.size ?? 10)));
    const search = toStr(req.query.search);
    const estado = (toStr(req.query.estado) || 'all').toLowerCase(); // registrada|cancelada|all

    // === Filtros de fecha con el mismo helper que clientes ===
    const fechaFrom = toDateOnlyUTC(toStr(req.query.fecha_from));
    const fechaTo   = toDateOnlyUTC(toStr(req.query.fecha_to));

    const where: any = {};

    if (fechaFrom || fechaTo) {
      where.fecha = {};
      if (fechaFrom) where.fecha.gte = fechaFrom;
      if (fechaTo)   where.fecha.lte = fechaTo;
    }

    if (estado === 'registrada' || estado === 'cancelada') {
      where.estado = estado;
    }

    if (search) {
      const or: any[] = [
        {
          clientes: {
            OR: [
              { nombre: { contains: search, mode: 'insensitive' } },
              { apellido: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
            ],
          },
        },
        {
          usuarios: {
            OR: [
              { nombre: { contains: search, mode: 'insensitive' } },
              { apellido: { contains: search, mode: 'insensitive' } },
              { username: { contains: search, mode: 'insensitive' } },
            ],
          },
        },
      ];
      const n = Number(search);
      if (Number.isFinite(n)) or.push({ idventa: n });
      where.OR = or;
    }

    const total = await prisma.ventas.count({ where });

    const items = await prisma.ventas.findMany({
      where,
      orderBy: [{ fecha: 'desc' }, { idventa: 'desc' }],
      skip: (page - 1) * size,
      take: size,
      select: {
        idventa: true,
        fecha: true,
        subtotal: true,
        descuentot: true,
        total: true,
        estado: true,
        idcliente: true,
        idusuario: true,
        clientes: { select: { nombre: true, apellido: true } },
        usuarios: { select: { username: true, nombre: true, apellido: true } },
      },
    });

    // Total de productos por venta
    const ids = items.map(v => v.idventa);
    let cantidadesByVenta = new Map<number, number>();
    if (ids.length) {
      const g = await prisma.ventas_detalle.groupBy({
        by: ['idventa'],
        where: { idventa: { in: ids } },
        _sum: { cantidad: true },
      });
      cantidadesByVenta = new Map(g.map(r => [r.idventa, Number(r._sum.cantidad ?? 0)]));
    }

    const enriched = items.map(v => ({
      idventa: v.idventa,
      fecha: v.fecha,
      subtotal: v.subtotal,
      descuentot: v.descuentot,
      total: v.total,
      estado: v.estado,
      cliente: v.clientes ? `${v.clientes.nombre} ${v.clientes.apellido}`.trim() : '—',
      usuario: v.usuarios ? (v.usuarios.username || `${v.usuarios.nombre} ${v.usuarios.apellido}`.trim()) : '—',
      totalProductos: cantidadesByVenta.get(v.idventa) ?? 0,
    }));

    res.json({ ok: true, page, size, total, items: enriched });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, message: 'Error listando ventas' });
  }
});

// ------------------- GET /api/ventas/:id -------------------
ventasRouter.get('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ ok: false, message: 'ID inválido' });
    }

    const venta = await prisma.ventas.findUnique({
      where: { idventa: id },
      select: {
        idventa: true,
        fecha: true,
        subtotal: true,
        descuentot: true,
        total: true,
        notas: true,
        estado: true,
        idcliente: true,
        idusuario: true,
        clientes: { select: { idcliente: true, nombre: true, apellido: true, email: true, telefono: true } },
        usuarios: { select: { idusuario: true, username: true, nombre: true, apellido: true } },
      },
    });

    if (!venta) return res.status(404).json({ ok: false, message: 'Venta no encontrada' });

    const detalles = await prisma.ventas_detalle.findMany({
      where: { idventa: id },
      orderBy: { iddetalle: 'asc' },
      select: {
        iddetalle: true,
        idproducto: true,
        cantidad: true,
        precio_unit: true,
        desc_pct: true,
        subtotal_linea: true,
        productos: { select: { sku: true, nombre: true, categoria: true, medida: true } },
      },
    });

    res.json({
      ok: true,
      venta: {
        ...venta,
        clienteNombre: venta.clientes ? `${venta.clientes.nombre} ${venta.clientes.apellido}`.trim() : null,
        usuarioNombre: venta.usuarios ? (venta.usuarios.username || `${venta.usuarios.nombre} ${venta.usuarios.apellido}`.trim()) : null,
      },
      detalles: detalles.map(d => ({
        ...d,
        productoNombre: d.productos?.nombre ?? '—',
        sku: d.productos?.sku ?? '—',
        categoria: d.productos?.categoria ?? null,
        medida: d.productos?.medida ?? null,
      })),
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, message: 'Error obteniendo venta' });
  }
});
