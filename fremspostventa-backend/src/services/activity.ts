import prisma from '../prisma';

export async function logActivity(params: {
  who_user_id?: number | null;
  what: string;
  type?: 'venta' | 'cliente' | 'recomendacion' | 'tarea' | 'otro';
  meta?: any;
}) {
  try {
    await prisma.actividad.create({
      data: {
        who_user_id: params.who_user_id ?? null,
        what: params.what,
        type: (params.type as any) ?? 'otro',
        meta: params.meta ?? undefined,
      },
    });
  } catch (e) {
    console.warn('[activity] failed:', (e as any)?.message || e);
  }
}
