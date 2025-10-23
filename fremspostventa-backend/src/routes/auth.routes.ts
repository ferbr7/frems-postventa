import { Router } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../prisma';
import { login, register } from '../controllers/auth.controller';
import { auth } from '../middlewares/auth';
import { genCode, hashCode, compareCode, CODE_TTL_MIN, MAX_ATTEMPTS } from '../utils/password-reset';
import { sendEmail } from '../services/mailer';

const router = Router();
router.post('/register', register);
router.post('/login', login);

router.get('/me', auth, async (req, res) => {
  const u = (req as any).user;
  res.json({ ok:true, user: u });
});

router.post('/forgot', async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const okResponse = () => res.json({ ok: true }); // no revelar si existe o no

  if (!email) return okResponse();

  const user = await prisma.usuarios.findUnique({
    where: { email },
    select: { idusuario: true, nombre: true }
  });
  if (!user) return okResponse();

  const code = genCode();
  const code_hash = await hashCode(code);
  const expires_at = new Date(Date.now() + CODE_TTL_MIN * 60_000);

  await prisma.password_resets.create({
    data: {
      user_id: user.idusuario,
      code_hash,
      expires_at,
      ip: req.ip || undefined
    }
  });

  // envía correo (si falla, no rompe el flujo)
  const subj = 'Tu código de recuperación';
  const html = `
    <p>Hola ${user.nombre ?? ''},</p>
    <p>Tu código de recuperación es <b style="font-size:18px">${code}</b>.</p>
    <p>Vence en ${CODE_TTL_MIN} minutos.</p>
  `;
  const text = `Hola ${user.nombre ?? ''}, tu código es ${code}. Vence en ${CODE_TTL_MIN} minutos.`;

  try {
    await sendEmail({ to: email, subject: subj, html, text });
  } catch (e) {
    console.warn('[mailer] forgot failed:', (e as any)?.message || e);
  }

  return okResponse();
});

/** POST /api/auth/reset { email, code, newPassword } */
router.post('/reset', async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const code  = String(req.body?.code || '').trim();
  const pwd   = String(req.body?.newPassword || '');

  if (!email || !/^\d{6}$/.test(code) || pwd.length < 8) {
    return res.status(400).json({ ok: false, message: 'Datos inválidos' });
  }

  const user = await prisma.usuarios.findUnique({
    where: { email },
    select: { idusuario: true }
  });
  if (!user) return res.json({ ok: true }); // no revelar

  const reset = await prisma.password_resets.findFirst({
    where: {
      user_id: user.idusuario,
      used_at: null,
      expires_at: { gt: new Date() },
      attempts: { lt: MAX_ATTEMPTS }
    },
    orderBy: { created_at: 'desc' }
  });
  if (!reset) return res.status(400).json({ ok: false, message: 'Código inválido o vencido' });

  const match = await compareCode(code, reset.code_hash);
  if (!match) {
    await prisma.password_resets.update({
      where: { id: reset.id },
      data: { attempts: { increment: 1 } }
    });
    return res.status(400).json({ ok: false, message: 'Código inválido' });
  }

  const pwdHash = await bcrypt.hash(pwd, 10);

  await prisma.$transaction([
    prisma.password_resets.update({ where: { id: reset.id }, data: { used_at: new Date() } }),
    prisma.usuarios.update({ where: { idusuario: user.idusuario }, data: { password: pwdHash } })
  ]);

  // invalida otros resets vigentes
  await prisma.password_resets.updateMany({
    where: { user_id: user.idusuario, used_at: null, expires_at: { gt: new Date() } },
    data: { used_at: new Date() }
  });

  return res.json({ ok: true });
});

export default router;
