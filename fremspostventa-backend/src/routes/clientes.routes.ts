import { Router } from 'express';
import prisma from '../prisma';
import { Prisma } from '@prisma/client';


export const clientesRouter = Router();

function toDateOnlyUTC(s?: string | null): Date | null {
    if (!s) return null;
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    if (!m) return null;
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const d = Number(m[3]);
    return new Date(Date.UTC(y, mo - 1, d));
}
function todayLocalISO(): string {
    const t = new Date();
    const y = t.getFullYear();
    const m = String(t.getMonth() + 1).padStart(2, '0');
    const d = String(t.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}
//Método post - crear clientes
clientesRouter.post('/', async (req, res) => {
    try {
        const { nombre, apellido, email, telefono, direccion, fechaingreso, ultimacompra } = req.body as {
            nombre?: string;
            apellido?: string;
            email?: string;
            telefono?: string;
            direccion?: string;
            fechaingreso?: string; // 'YYYY-MM-DD'
            ultimacompra?: string; // 'YYYY-MM-DD'
        };


        if (!nombre || !apellido) {
            return res.status(400).json({ ok: false, message: 'Nombre y apellido son requeridos.' });
        }
        if (!telefono || !/^\d{8}$/.test(telefono)) {
            return res.status(400).json({ ok: false, message: 'Teléfono inválido (deben ser 8 dígitos).' });
        }
        if (!direccion || !String(direccion).trim()) {
            return res.status(400).json({ ok: false, message: 'Dirección es requerida.' });
        }

        const dup = await prisma.clientes.findFirst({
            where: { telefono },
            select: { idcliente: true },
        });
        if (dup) {
            return res.status(409).json({ ok: false, message: 'El teléfono ya está en uso.' });
        }

        const rawEmail = typeof email === 'string' ? email.trim() : '';
        const safeEmail = rawEmail === '' ? null : rawEmail;

        const data: any = {
            nombre,
            apellido,
            email: safeEmail,
            telefono,
            direccion: String(direccion).trim(),
        };

        const fi = toDateOnlyUTC(typeof fechaingreso === 'string' ? fechaingreso : todayLocalISO())!;
        if (fi) data.fechaingreso = fi;
        const uc = (typeof ultimacompra === 'string' && ultimacompra.trim())
            ? toDateOnlyUTC(ultimacompra)
            : null;
        if (uc) data.ultimacompra = uc;

        const cliente = await prisma.clientes.create({
            data,
            select: {
                idcliente: true,
                nombre: true,
                apellido: true,
                email: true,
                telefono: true,
                direccion: true,
                fechaingreso: true,
                ultimacompra: true,
            },
        });

        return res.json({ ok: true, cliente });
    } catch (err: any) {

        if (err.code === 'P2002') {
            return res.status(409).json({ ok: false, message: 'El teléfono ya está en uso.' });
        }
        console.error(err);
        return res.status(500).json({ ok: false, message: 'Error creando cliente' });
    }
});

//Método get para buscar cliente por ID
clientesRouter.get('/:id', async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isFinite(id)) {
            return res.status(400).json({ ok: false, message: 'ID inválido' });
        }

        const cliente = await prisma.clientes.findUnique({
            where: { idcliente: id },
            select: {
                idcliente: true,
                nombre: true,
                apellido: true,
                email: true,
                telefono: true,
                direccion: true,
                fechaingreso: true,
                ultimacompra: true,
            },
        });

        if (!cliente) {
            return res.status(404).json({ ok: false, message: 'Cliente no encontrado' });
        }

        return res.json({ ok: true, cliente });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ ok: false, message: 'Error obteniendo cliente' });
    }
});

//Método get para buscar cliente en barra de búsqueda
clientesRouter.get('/', async (req, res) => {
  try {
    const search = String(req.query.search ?? '').trim();
    const page = Math.max(1, Number(req.query.page ?? 1));
    const size = Math.min(100, Math.max(1, Number(req.query.size ?? 5)));
    const order = String(req.query.order ?? 'recientes');

    const where: any = {};

    if (search) {
      where.OR = [
        { nombre:   { contains: search, mode: 'insensitive' } },
        { apellido: { contains: search, mode: 'insensitive' } },
        { email:    { contains: search, mode: 'insensitive' } },
        { telefono: { contains: search } },
      ];
    }

    const total = await prisma.clientes.count({ where });

    const items = await prisma.clientes.findMany({
      where,
      orderBy: { fechaingreso: order === 'antiguos' ? 'asc' : 'desc' },
      skip: (page - 1) * size,
      take: size,
      select: {
        idcliente: true,
        nombre: true,
        apellido: true,
        email: true,
        telefono: true,
        direccion: true,
        fechaingreso: true,
        ultimacompra: true,
      },
    });

    const ids = items.map(c => c.idcliente);
    let comprasByCliente = new Map<number, number>();
    if (ids.length) {
      const g = await prisma.ventas.groupBy({
        by: ['idcliente'],
        where: {
          idcliente: { in: ids },
          estado: { equals: 'registrada' }, 
        },
        _count: { idventa: true },
      });
      comprasByCliente = new Map(g.map(r => [Number(r.idcliente), Number(r._count.idventa || 0)]));
    }

    const enriched = items.map(c => ({
      ...c,
      compras: comprasByCliente.get(c.idcliente) ?? 0,
    }));

    return res.json({ ok: true, page, size, total, items: enriched }); 
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, message: 'Error listando clientes' });
  }
});

//Método put para actualizar cliente
clientesRouter.put('/:id', async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isFinite(id)) {
            return res.status(400).json({ ok: false, message: 'ID inválido' });
        }

        const {
            nombre,
            apellido,
            email,
            telefono,
            direccion,
            fechaingreso: fechaingresoRaw,
            ultimacompra: ultimacompraRaw,
        } = req.body as Record<string, any>;

        const actual = await prisma.clientes.findUnique({
            where: { idcliente: id },
            select: { idcliente: true, telefono: true },
        });
        if (!actual) {
            return res.status(404).json({ ok: false, message: 'Cliente no encontrado' });
        }

        const data: any = {};

        // Campos string: si vienen definidos, actualizamos (permite vacío en email/direccion si querés)
        if (typeof nombre === 'string') data.nombre = nombre.trim();
        if (typeof apellido === 'string') data.apellido = apellido.trim();
        if (typeof email === 'string') data.email = email.trim();
        if (typeof direccion === 'string') data.direccion = direccion.trim();

        // Teléfono: si viene, validar 8 dígitos y unicidad
        if (telefono !== undefined) {
            const tel = String(telefono).trim();
            if (!/^\d{8}$/.test(tel)) {
                return res.status(400).json({ ok: false, message: 'Teléfono inválido (deben ser 8 dígitos).' });
            }

            if (tel !== actual.telefono) {
                const dup = await prisma.clientes.findFirst({
                    where: { telefono: tel, NOT: { idcliente: id } },
                    select: { idcliente: true },
                });
                if (dup) {
                    return res.status(409).json({ ok: false, message: 'El teléfono ya está en uso.' });
                }
            }
            data.telefono = tel;
        }
        if (direccion !== undefined) {
            const dir = String(direccion).trim();
            if (!dir) return res.status(400).json({ ok: false, message: 'Dirección no puede quedar vacía.' });
            data.direccion = dir;
        }
        if (email !== undefined) {
            const raw = typeof email === 'string' ? email.trim() : '';
            data.email = raw === '' ? null : raw;
        }

        const fechaingresoStr = (fechaingresoRaw ?? fechaingresoRaw) as string | undefined;
        const ultimacompraStr = (ultimacompraRaw ?? ultimacompraRaw) as string | undefined;

        if (fechaingresoStr !== undefined) {
            const s = (fechaingresoStr ?? '').trim();
            if (s !== '') {
                const fi = toDateOnlyUTC(s);
                if (!fi) return res.status(400).json({ ok: false, message: 'fechaingreso inválida (YYYY-MM-DD).' });
                data.fechaingreso = fi;
            }
        }
        if (ultimacompraStr !== undefined) {
            const s = (ultimacompraStr ?? '').trim();
            if (s === '') {
                data.ultimacompra = null;
            } else {
                const uc = toDateOnlyUTC(s);
                if (!uc) return res.status(400).json({ ok: false, message: 'ultimacompra inválida (YYYY-MM-DD).' });
                data.ultimacompra = uc;
            }
        }


        if (Object.keys(data).length === 0) {
            return res.status(400).json({ ok: false, message: 'No hay campos válidos para actualizar.' });
        }

        const cliente = await prisma.clientes.update({
            where: { idcliente: id },
            data,
            select: {
                idcliente: true,
                nombre: true,
                apellido: true,
                email: true,
                telefono: true,
                direccion: true,
                fechaingreso: true,
                ultimacompra: true,
            },
        });

        return res.json({ ok: true, cliente });
    } catch (err: any) {

        if (err?.code === 'P2002') {
            return res.status(409).json({ ok: false, message: 'El teléfono ya está en uso.' });
        }
        console.error(err);
        return res.status(500).json({ ok: false, message: 'Error actualizando cliente' });
    }
});