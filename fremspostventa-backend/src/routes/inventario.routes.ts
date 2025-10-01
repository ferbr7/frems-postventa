import { Router } from 'express';
import prisma from '../prisma';

export const inventarioRouter = Router();


function toDateOnlyUTC(s?: string | null): Date | null {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const y  = Number(m[1]);
  const mo = Number(m[2]);   
  const d  = Number(m[3]);
  return new Date(Date.UTC(y, mo - 1, d));
}

function todayLocalISO(): string {
  const t = new Date();
  const y = t.getFullYear();
  const m = String(t.getMonth() + 1).padStart(2,'0');
  const d = String(t.getDate()).padStart(2,'0');
  return `${y}-${m}-${d}`;
}

inventarioRouter.post('/entradas', async (req, res) => {
  try {
    const { idproducto, cantidad, preciocosto, fechaentrada, proveedor, idusuario } = req.body ?? {};

    const idProd = Number(idproducto);
    const cant   = Number(cantidad);
    const costo  = Number(preciocosto);

    if (!Number.isFinite(idProd) || idProd <= 0)
      return res.status(400).json({ ok:false, message:'Producto inválido.' });
    if (!Number.isFinite(cant) || cant <= 0 || Math.trunc(cant) !== cant)
      return res.status(400).json({ ok:false, message:'Cantidad debe ser entero > 0.' });
    if (!Number.isFinite(costo) || costo < 0)
      return res.status(400).json({ ok:false, message:'Precio costo inválido.' });

    const f = toDateOnlyUTC(typeof fechaentrada === 'string' ? fechaentrada : todayLocalISO())!;
    const prov = (proveedor ?? '').toString().trim() || null;
    const idUser = idusuario ? Number(idusuario) : null;

    // Verificar producto existe
    const prod = await prisma.productos.findUnique({
      where: { idproducto: idProd },
      select: { idproducto: true, stock: true }
    });
    if (!prod) return res.status(404).json({ ok:false, message:'Producto no encontrado.' });

    // Transacción: crear entrada + subir stock
    const [entrada, updated] = await prisma.$transaction([
      prisma.inventario_entradas.create({
        data: {
          idproducto: idProd,
          idusuario: idUser ?? undefined,
          cantidad: cant,
          preciocosto: costo,
          fechaentrada: f,
          proveedor: prov
        },
        select: {
          identrada: true, idproducto: true, idusuario: true,
          cantidad: true, preciocosto: true, fechaentrada: true, proveedor: true
        }
      }),
      prisma.productos.update({
        where: { idproducto: idProd },
        data: { stock: { increment: cant } },
        select: { idproducto: true, stock: true }
      })
    ]);

    return res.json({ ok:true, entrada, producto: updated });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok:false, message:'Error registrando entrada de inventario' });
  }
});

