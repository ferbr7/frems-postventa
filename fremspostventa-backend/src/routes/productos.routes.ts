import { Router } from 'express';
import prisma from '../prisma';

export const productosRouter = Router();

const toStr = (v: unknown) => String(v ?? '').trim();
const toInt = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : NaN;
};
const toNum = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
};

productosRouter.post('/', async (req, res) => {
  try {
    const {
      sku,
      nombre,
      descripcion,
      categoria,
      precioventa,
      precioVenta,
      stock,
      medida,
      activo,
      estado,
      duracionestimadodias,
    } = req.body as Record<string, any>;

    const _sku = toStr(sku);
    const _nom = toStr(nombre);
    const _desc = toStr(descripcion);
    const _cat = toStr(categoria);
    const _med = toStr(medida);

    const _precio = isNaN(toNum(precioventa)) ? toNum(precioVenta) : toNum(precioventa);
    const _stock = isNaN(toInt(stock)) ? 0 : toInt(stock);
    const _activo = typeof activo === 'boolean' ? activo :
      typeof estado === 'boolean' ? estado : true;

    const _dur = duracionestimadodias === undefined || duracionestimadodias === null
      ? undefined
      : toInt(duracionestimadodias);

    if (!_sku) return res.status(400).json({ ok: false, message: 'SKU es requerido.' });
    if (!_nom) return res.status(400).json({ ok: false, message: 'Nombre es requerido.' });
    if (isNaN(_precio) || _precio < 0)
      return res.status(400).json({ ok: false, message: 'Precio inválido.' });
    if (isNaN(_stock) || _stock < 0)
      return res.status(400).json({ ok: false, message: 'Stock inválido.' });
    if (_dur !== undefined && (isNaN(_dur) || _dur < 1 || _dur > 3650))
      return res.status(400).json({ ok: false, message: 'duracionestimadodias fuera de rango (1..3650).' });

    const dup = await prisma.productos.findFirst({
      where: { sku: { equals: _sku, mode: 'insensitive' } },
      select: { idproducto: true }
    });
    if (dup) return res.status(409).json({ ok: false, message: 'El SKU ya está en uso.' });

    const data: any = {
      sku: _sku,
      nombre: _nom,
      descripcion: _desc || null,
      categoria: _cat || null,
      precioventa: _precio,
      stock: _stock,
      medida: _med || null,
      activo: _activo,
    };
    if (_dur !== undefined) data.duracionestimadodias = _dur;

    const prod = await prisma.productos.create({
      data,
      select: {
        idproducto: true, sku: true, nombre: true, descripcion: true,
        categoria: true, precioventa: true, stock: true, medida: true,
        activo: true, fechaalta: true,
        duracionestimadodias: true,
      }
    });

    return res.json({ ok: true, producto: prod });
  } catch (err: any) {
    if (err?.code === 'P2002') {
      return res.status(409).json({ ok: false, message: 'El SKU ya está en uso.' });
    }
    console.error(err);
    return res.status(500).json({ ok: false, message: 'Error creando producto' });
  }
});


productosRouter.get('/', async (req, res) => {
  try {
    const search = toStr(req.query.search);
    const page = Math.max(1, Number(req.query.page ?? 1));
    const size = Math.min(100, Math.max(1, Number(req.query.size ?? 5)));
    const order = (toStr(req.query.order) || 'mod').toLowerCase() as 'mod' | 'recientes' | 'antiguos';
    const activoQ = (toStr(req.query.activo) || 'all').toLowerCase();

    const where: any = {};

    if (search) {
      where.OR = [
        { nombre: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
        { categoria: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (activoQ === 'true') where.activo = true;
    if (activoQ === 'false') where.activo = false;

    const orderBy: any[] = [];
    if (activoQ === 'all') orderBy.push({ activo: 'desc' }); // true primero

    if (order === 'mod') {
      orderBy.push({ fechamod: 'desc' }, { fechaalta: 'desc' }); // última modificación
    } else {
      orderBy.push({ fechaalta: order === 'antiguos' ? 'asc' : 'desc' }, { fechamod: 'desc' });
    }

    const total = await prisma.productos.count({ where });

    const items = await prisma.productos.findMany({
      where,
      orderBy,
      skip: (page - 1) * size,
      take: size,
      select: {
        idproducto: true, sku: true, nombre: true, descripcion: true,
        categoria: true, medida: true, precioventa: true, stock: true,
        activo: true, fechaalta: true,
      },
    });

    return res.json({ ok: true, page, size, total, items });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, message: 'Error listando productos' });
  }
});


productosRouter.get('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ ok: false, message: 'ID inválido' });

    const p = await prisma.productos.findUnique({
      where: { idproducto: id },
      select: {
        idproducto: true, sku: true, nombre: true, descripcion: true,
        categoria: true, precioventa: true, stock: true, medida: true,
        activo: true, fechaalta: true,
        duracionestimadodias: true,
      },
    });
    if (!p) return res.status(404).json({ ok: false, message: 'Producto no encontrado' });

    return res.json({ ok: true, producto: p });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, message: 'Error obteniendo producto' });
  }
});


productosRouter.put('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ ok: false, message: 'ID inválido' });

    const {
      sku, nombre, descripcion, categoria,
      precioventa, precioVenta, stock, medida,
      activo, estado,
      duracionestimadodias,
    } = req.body as Record<string, any>;

    const data: any = {};

    if (sku !== undefined) {
      const _sku = toStr(sku);
      if (!_sku) return res.status(400).json({ ok: false, message: 'SKU no puede estar vacío.' });

      const current = await prisma.productos.findUnique({
        where: { idproducto: id },
        select: { sku: true }
      });
      if (!current) return res.status(404).json({ ok: false, message: 'Producto no encontrado' });

      if (_sku.toLowerCase() !== current.sku.toLowerCase()) {
        const dup = await prisma.productos.findFirst({
          where: { sku: { equals: _sku, mode: 'insensitive' }, NOT: { idproducto: id } },
          select: { idproducto: true }
        });
        if (dup) return res.status(409).json({ ok: false, message: 'El SKU ya está en uso.' });
      }
      data.sku = _sku;
    }

    if (nombre !== undefined) data.nombre = toStr(nombre);
    if (descripcion !== undefined) data.descripcion = toStr(descripcion) || null;
    if (categoria !== undefined) data.categoria = toStr(categoria) || null;
    if (medida !== undefined) data.medida = toStr(medida) || null;

    if (precioventa !== undefined || precioVenta !== undefined) {
      const _precio = isNaN(toNum(precioventa)) ? toNum(precioVenta) : toNum(precioventa);
      if (isNaN(_precio) || _precio < 0) {
        return res.status(400).json({ ok: false, message: 'Precio inválido.' });
      }
      data.precioventa = _precio;
    }

    if (stock !== undefined) {
      const _stock = toInt(stock);
      if (isNaN(_stock) || _stock < 0) return res.status(400).json({ ok: false, message: 'Stock inválido.' });
      data.stock = _stock;
    }

    if (typeof activo === 'boolean') data.activo = activo;
    if (typeof estado === 'boolean') data.activo = estado;

    if (duracionestimadodias !== undefined) {
      const _dur = toInt(duracionestimadodias);
      if (isNaN(_dur) || _dur < 1 || _dur > 3650) {
        return res.status(400).json({ ok: false, message: 'duracionestimadodias fuera de rango (1..3650).' });
      }
      data.duracionestimadodias = _dur;
    }

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ ok: false, message: 'No hay campos válidos para actualizar.' });
    }

    const prod = await prisma.productos.update({
      where: { idproducto: id },
      data,
      select: {
        idproducto: true, sku: true, nombre: true, descripcion: true,
        categoria: true, precioventa: true, stock: true, medida: true,
        activo: true, fechaalta: true,
        duracionestimadodias: true,
      },
    });

    return res.json({ ok: true, producto: prod });
  } catch (err: any) {
    if (err?.code === 'P2002') {
      return res.status(409).json({ ok: false, message: 'El SKU ya está en uso.' });
    }
    console.error(err);
    return res.status(500).json({ ok: false, message: 'Error actualizando producto' });
  }
});
