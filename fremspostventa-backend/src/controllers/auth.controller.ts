import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import prisma from '../prisma';

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
    const { username , password } = req.body;
    if (!username || !password) return res.status(400).json({ ok: false, message: 'Usuario/correo y contraseña son obligatorios.' });

    const user = await prisma.usuarios.findFirst({ where: { OR: [{ username }, { email: username }] } });
    if (!user) return res.status(401).json({ ok: false, message: 'Credenciales inválidas' });

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ ok: false, message: 'Credenciales inválidas' });

    const token = jwt.sign(
      { sub: user.idusuario, role: user.idrol, username: user.username },
      process.env.JWT_SECRET || 'dev_secret',
      { expiresIn: '8h' }
    );

    return res.json({
      ok: true,
      token,
      user: {
        idusuario: user.idusuario,
        nombre: user.nombre,
        apellido: user.apellido,
        email: user.email,
        username: user.username,
        idrol: user.idrol
      }
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, message: 'Error al iniciar sesión' });
  }
}
