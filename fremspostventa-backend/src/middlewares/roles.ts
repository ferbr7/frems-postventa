import { Request, Response, NextFunction } from 'express';

export function requireRole(...roles: Array<'admin'|'vendedor'>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const r = (req as any)?.user?.rol;
    if (!r) return res.status(401).json({ ok:false, message:'No autorizado' });
    if (!roles.includes(r)) return res.status(403).json({ ok:false, message:'Prohibido' });
    next();
  };
}
