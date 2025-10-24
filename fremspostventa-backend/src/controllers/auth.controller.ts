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
    const { username, password } = req.body ?? {};
    if (!username || !password) {
      return res.status(400).json({ ok: false, message: 'Usuario/correo y contraseña son obligatorios.' });
    }

    const user = await prisma.usuarios.findFirst({
      where: {
        OR: [
          { username: { equals: String(username), mode: 'insensitive' } },
          { email:    { equals: String(username), mode: 'insensitive' } },
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
        roles:     { select: { nombre: true } },
        must_change_password: true,
      },
    });

    if (!user) return res.status(401).json({ ok: false, message: 'Credenciales inválidas' });

    const ok = await bcrypt.compare(String(password), user.password);
    if (!ok) return res.status(401).json({ ok: false, message: 'Credenciales inválidas' });

    // Si es primer ingreso, forzar cambio de contraseña
    if (user.must_change_password) {
      return res.status(412).json({
        ok: false,
        code: 'MUST_CHANGE_PASSWORD',
        email: user.email,
        message: 'Debes cambiar tu contraseña antes de ingresar.',
      });
    }

    const rol = (user.roles?.nombre || (user.idrol === 1 ? 'admin' : 'vendedor')).toLowerCase();
    const payload = { sub: user.idusuario, username: user.username, rol };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '2h' });

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
export async function changePasswordFirstLogin(req: Request, res: Response) {
  try {
    const { email, newPassword } = req.body ?? {};
    if (!email || !newPassword) {
      return res.status(400).json({ ok: false, message: 'Faltan email y/o nueva contraseña.' });
    }

    // Reglas de contraseña: 8+, 1 mayúscula, 1 minúscula, 1 número (ajusta si querés)
    const strong = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
    if (!strong.test(String(newPassword))) {
      return res.status(400).json({ ok: false, message: 'La contraseña no cumple los requisitos mínimos.' });
    }

    const user = await prisma.usuarios.findFirst({
      where: { email: { equals: String(email), mode: 'insensitive' } },
      select: { idusuario: true, must_change_password: true },
    });

    if (!user) return res.status(404).json({ ok: false, message: 'Usuario no encontrado.' });

    if (!user.must_change_password) {
      return res.status(409).json({ ok: false, message: 'Este usuario no requiere cambio de contraseña.' });
    }

    const hash = await bcrypt.hash(String(newPassword), 10);

    await prisma.usuarios.update({
      where: { idusuario: user.idusuario },
      data: {
        password: hash,
        must_change_password: false,
        password_changed_at: new Date(),
      },
    });

    return res.json({ ok: true, message: 'Contraseña actualizada.' });
  } catch (e) {
    console.error('[auth/change-password]', e);
    return res.status(500).json({ ok: false, message: 'Error cambiando contraseña.' });
  }
}