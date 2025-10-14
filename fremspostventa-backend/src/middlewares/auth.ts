// src/middlewares/auth.ts
import { Request, Response, NextFunction } from 'express';
import jwt, { JwtPayload } from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret';

export interface AuthUser {
  idusuario: number;
  username: string;
  rol: 'admin' | 'vendedor' | string;
}

declare global {
  namespace Express {
    interface Request { user?: AuthUser | null }
  }
}

export function auth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ ok: false, message: 'No autorizado' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;

    // Compatibilidad por si alguna vez firmaste usando "role" numérico
    const roleNum = typeof decoded.role === 'number' ? decoded.role : undefined;
    const rolFromNum = roleNum === 1 ? 'admin' : roleNum ? 'vendedor' : undefined;

    const rol = (decoded as any).rol || rolFromNum || 'vendedor';

    req.user = {
      idusuario: Number(decoded.sub),
      username:  String(decoded.username || ''),
      rol,
    };
    return next();
  } catch {
    return res.status(401).json({ ok: false, message: 'Token inválido' });
  }
}

// (opcional) para proteger por rol:
export function requireRole(roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ ok: false, message: 'No autorizado' });
    if (!roles.includes(req.user.rol)) {
      return res.status(403).json({ ok: false, message: 'Permisos insuficientes' });
    }
    next();
  };
}
