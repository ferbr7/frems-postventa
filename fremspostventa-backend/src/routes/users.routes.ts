import { Router } from 'express';
import prisma from '../prisma';
import bcrypt from 'bcrypt';
import { Prisma } from '@prisma/client';

const router = Router();

/**
 * GET /api/usuarios
 * ?page=1&limit=10&search=texto&idrol=1&activo=true
 */
router.get('/', async (req, res) => {
  try {
    const page = parseInt((req.query.page as string) ?? '1', 10);
    const limit = parseInt((req.query.limit as string) ?? '10', 10);
    const skip = (page - 1) * limit;

    const search = (req.query.search as string) ?? '';
    const idrol = req.query.idrol ? Number(req.query.idrol) : undefined;
    const activo = typeof req.query.activo === 'string'
      ? req.query.activo === 'true'
      : undefined;

    const where: any = {};
    if (search) {
      where.OR = [
        { nombre: { contains: search, mode: 'insensitive' } },
        { apellido: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { username: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (idrol) where.idrol = idrol;
    if (activo !== undefined) where.activo = activo;

    const [items, total] = await Promise.all([
      prisma.usuarios.findMany({
        where, skip, take: limit,
        orderBy: { fechaalta: 'desc' },
        select: {
          idusuario: true, nombre: true, apellido: true, email: true,
          username: true, activo: true, fechaalta: true, idrol: true,
          roles: { select: { nombre: true } }
        }
      }),
      prisma.usuarios.count({ where }),
    ]);

    res.json({ ok: true, page, limit, total, items });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, message: 'Error listando usuarios' });
  }
});

router.get('/exists', async (req, res) => {
  try {
    const username = String(req.query.username ?? '').trim();
    if (!username) return res.status(400).json({ ok: false, message: 'username requerido' });

    const u = await prisma.usuarios.findUnique({ where: { username } });
    return res.json({ ok: true, exists: !!u });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, message: 'Error al verificar username' });
  }
});

router.get('/suggest-username', async (req, res) => {
  try {
    const nombre = (req.query.nombre as string || '').trim();
    const apellido = (req.query.apellido as string || '').trim();

    if (!nombre || !apellido) {
      return res.status(400).json({ ok: false, message: 'nombre y apellido son requeridos' });
    }

    const norm = (s: string) =>
      s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

    const base = (norm(nombre).charAt(0) || '') + norm(apellido);
    if (!base) return res.json({ ok: true, suggestion: '' });

    // Busca todos los que ya empiezan con "base"
    const existing = await prisma.usuarios.findMany({
      where: { username: { startsWith: base } },
      select: { username: true }
    });

    const taken = new Set(existing.map(e => e.username));

    if (!taken.has(base)) {
      return res.json({ ok: true, suggestion: base });
    }

    let i = 1;
    while (taken.has(`${base}${i}`)) i++;
    return res.json({ ok: true, suggestion: `${base}${i}` });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, message: 'Error sugiriendo username' });
  }
});

/** GET /api/usuarios/:id */
router.get('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const user = await prisma.usuarios.findUnique({
      where: { idusuario: id },
      select: {
        idusuario: true, nombre: true, apellido: true, email: true,
        username: true, activo: true, fechaalta: true, idrol: true
      }
    });
    if (!user) return res.status(404).json({ ok: false, message: 'No encontrado' });
    res.json({ ok: true, user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, message: 'Error obteniendo usuario' });
  }
});

/** POST /api/usuarios */
router.post('/', async (req, res) => {
  try {
    const { nombre, apellido, email, username, password, idrol, activo, fechaalta } = req.body;
    if (!nombre || !apellido || !email || !username || !password || !idrol || !fechaalta) {
      return res.status(400).json({ ok: false, message: 'Campos requeridos faltantes' });
    }

    const existente = await prisma.usuarios.findFirst({ where: { OR: [{ email }, { username }] } });
    if (existente) return res.status(409).json({ ok: false, message: 'Email o username en uso' });

    const hash = await bcrypt.hash(password, 10);

    const nuevo = await prisma.usuarios.create({
      data: { nombre, apellido, email, username, password: hash, idrol: Number(idrol), activo: activo ?? true, fechaalta: fechaalta ? new Date(fechaalta) : undefined, },
      select: {
        idusuario: true, nombre: true, apellido: true, email: true,
        username: true, activo: true, fechaalta: true, idrol: true
      }
    });
    res.status(201).json({ ok: true, user: nuevo });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, message: 'Error creando usuario' });
  }
});

/** PUT /api/usuarios/:id (sin cambiar password aquí) */

router.put('/:id', async (req, res) => {
  console.log('PUT /usuarios/:id', { id: req.params.id, body: req.body }); 
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ ok: false, message: 'ID inválido' });
    }

    const { idrol, activo, fechaalta, email } = req.body as {
      idrol?: number | string;
      activo?: boolean | string;
      fechaalta?: string;
      email?: string;
    };

    const data: any = {};

    // rol
    if (idrol !== undefined && idrol !== null && idrol !== '') {
      const idrolNum = Number(idrol);
      if (!Number.isFinite(idrolNum)) {
        return res.status(400).json({ ok: false, message: 'Rol inválido' });
      }
      data.idrol = idrolNum;
    }

    // activo
    if (activo !== undefined) {
      data.activo = typeof activo === 'boolean' ? activo : String(activo).toLowerCase() === 'true';
    }

    // fechaalta
    if (fechaalta) {
      const [y, m, d] = String(fechaalta).split('-').map(Number);
      const dUtc = new Date(Date.UTC(y, (m - 1), d));
      if (isNaN(dUtc.getTime())) {
        return res.status(400).json({ ok: false, message: 'fechaalta inválida' });
      }
      data.fechaalta = dUtc;
    }

    // email (validación de duplicado con 409)
    if (email) {
      const current = await prisma.usuarios.findUnique({
        where: { idusuario: id },
        select: { email: true },
      });
      if (!current) {
        return res.status(404).json({ ok: false, message: 'Usuario no encontrado' });
      }
      const changed = current.email?.toLowerCase() !== email.toLowerCase();
      if (changed) {
        const duplicate = await prisma.usuarios.findFirst({
          where: { email: { equals: email, mode: 'insensitive' }, NOT: { idusuario: id } },
          select: { idusuario: true },
        });
        if (duplicate) {
          
          return res.status(409).json({ ok: false, message: 'El correo ya está en uso por otro usuario.' });
        }
        data.email = email;
      }
    }

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ ok: false, message: 'No hay campos válidos para actualizar.' });
    }

    const upd = await prisma.usuarios.update({
      where: { idusuario: id },
      data,
      select: {
        idusuario: true, nombre: true, apellido: true, email: true,
        username: true, activo: true, fechaalta: true, idrol: true
      }
    });

    return res.json({ ok: true, user: upd });

  } catch (err: any) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      const target = (err as any).meta?.target as string[] | undefined;
      if (target?.includes('email')) {
        return res.status(409).json({ ok: false, message: 'El correo ya está en uso por otro usuario.' });
      }
    }
    console.error(err);
    return res.status(500).json({ ok: false, message: 'Error actualizando usuario' });
  }
});


/** PATCH /api/usuarios/:id/password */
router.patch('/:id/password', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { newPassword } = req.body;
    if (!newPassword) return res.status(400).json({ ok: false, message: 'Nueva contraseña requerida' });

    const hash = await bcrypt.hash(newPassword, 10);
    await prisma.usuarios.update({
      where: { idusuario: id },
      data: { password: hash }
    });
    res.json({ ok: true, message: 'Contraseña actualizada' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, message: 'Error cambiando contraseña' });
  }
});

/** PATCH /api/usuarios/:id/estado  (activar/desactivar) */
router.patch('/:id/estado', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { activo } = req.body;
    const upd = await prisma.usuarios.update({
      where: { idusuario: id },
      data: { activo: Boolean(activo) },
      select: { idusuario: true, activo: true }
    });
    res.json({ ok: true, user: upd });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, message: 'Error cambiando estado' });
  }
});

/** DELETE /api/usuarios/:id (borrado real; si prefieres soft, cambia a activo=false) */
router.delete('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    await prisma.usuarios.delete({ where: { idusuario: id } });
    res.json({ ok: true, message: 'Eliminado' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, message: 'Error eliminando usuario' });
  }
});


export default router;
