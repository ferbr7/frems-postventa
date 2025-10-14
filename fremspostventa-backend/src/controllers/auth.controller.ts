import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import prisma from '../prisma';

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret';

export async function register(req: Request, res: Response) {
  try {
    const { nombre, apellido, email, username, password, idrol } = req.body;
    if (!nombre || !apellido || !email || !username || !password) {
      return res.status(400).json({ ok: false, message: 'Faltan campos obligatorios.' });
    }

    const existe = await prisma.usuarios.findFirst({ where: { OR: [{ email }, { username }] } });
    if (existe) return res.status(409).json({ ok: false, message: 'Email o username ya está en uso.' });

    const hash = await bcrypt.hash(password, 10);

    const nuevo = await prisma.usuarios.create({
      data: { nombre, apellido, email, username, password: hash, idrol: idrol ?? 2 },
      select: { idusuario: true, nombre: true, apellido: true, email: true, username: true, idrol: true }
    });

    return res.status(201).json({ ok: true, usuario: nuevo });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, message: 'Error al registrar' });
  }
}

export async function login(req: Request, res: Response) {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ ok: false, message: 'Usuario/correo y contraseña son obligatorios.' });
    }

    // Permitir login por username o email y traer el nombre del rol
    const user = await prisma.usuarios.findFirst({
      where: {
        OR: [
          { username: { equals: username, mode: 'insensitive' } },
          { email:    { equals: username, mode: 'insensitive' } },
        ],
        activo: true,
      },
      select: {
        idusuario: true,
        username:  true,
        nombre:    true,
        apellido:  true,
        email:     true,
        password:  true,
        idrol:     true,
        roles:     { select: { nombre: true } }, // <- nombre del rol
      },
    });

    if (!user) return res.status(401).json({ ok: false, message: 'Credenciales inválidas' });

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ ok: false, message: 'Credenciales inválidas' });

    // Rol como texto (fallback por si no hay relación)
    const rol = (user.roles?.nombre || (user.idrol === 1 ? 'admin' : 'vendedor')).toLowerCase();

    // Firma del token con los campos que el frontend y middlewares esperan
    const payload = { sub: user.idusuario, username: user.username, rol };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '8h' });

    return res.json({
      ok: true,
      token,
      user: {
        idusuario: user.idusuario,
        nombre:    user.nombre,
        apellido:  user.apellido,
        email:     user.email,
        username:  user.username,
        rol,                          
      },
    });
  } catch (err) {
    console.error('[auth/login] error', err);
    return res.status(500).json({ ok: false, message: 'Error al iniciar sesión' });
  }
}