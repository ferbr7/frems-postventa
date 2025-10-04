import cron from 'node-cron';
import axios from 'axios';
import prisma from './prisma';

type Reason = 'cycle' | 'dormant' | 'no_purchases_old' | 'no_purchases';

const API_BASE = process.env.API_BASE || 'http://localhost:4000';
const ENABLED = String(process.env.RECS_AUTO_ENABLED || 'false') === 'true';

// Limites / ventanas
const DAILY_LIMIT = Number(process.env.RECS_DAILY_LIMIT || 20);
const COOLDOWN_DAYS_ALL = Number(process.env.RECS_COOLDOWN_DAYS || 14); // no repetir cliente dentro de X días
const RUN_AT_CRON = process.env.RECS_RUN_AT_CRON || '19 20 * * *';  // 08:30 todos los días
const TZ = process.env.RECS_TZ || 'America/Guatemala';

// Qué motivos procesar automáticamente (coma separada)
const REASONS = (process.env.RECS_AUTO_REASONS || 'cycle,dormant,no_purchases_old,no_purchases')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean) as Reason[];

export function startRecsScheduler() {
    if (!ENABLED) {
        console.log('[recs-scheduler] deshabilitado (RECS_AUTO_ENABLED=false)');
        return;
    }

    cron.schedule(RUN_AT_CRON, async () => {
        console.log('[recs-scheduler] run start');
        try {
            // 1) refrescar candidatos
            await prisma.$executeRawUnsafe(`REFRESH MATERIALIZED VIEW rec_candidates_daily;`);

            // 2) leer candidatos de la MV
            const rows = await prisma.$queryRawUnsafe<Array<{ idcliente: number; reason: Reason }>>(
                `SELECT idcliente, reason FROM rec_candidates_daily`
            );

            // 3) filtrar por motivos permitidos
            let candidates = rows.filter(r => REASONS.includes(r.reason));

            // 4) cooldown: evitar clientes con recomendación reciente (pendiente/enviado)
            const since = new Date();
            since.setUTCDate(since.getUTCDate() - COOLDOWN_DAYS_ALL);

            const filtered: Array<{ idcliente: number; reason: Reason }> = [];
            for (const r of candidates) {
                const recent = await prisma.recomendaciones.findFirst({
                    where: {
                        idcliente: r.idcliente,
                        fechageneracion: { gte: since },
                        estado: { in: ['pendiente', 'enviado'] },
                    },
                    select: { idrecomendacion: true },
                });
                if (!recent) filtered.push(r);
                if (filtered.length >= DAILY_LIMIT) break;
            }

            // 5) generar recomendación reusando tu endpoint ya funcional
            for (const r of filtered) {
                try {
                    await axios.post(`${API_BASE}/api/recs/generate`, {
                        idcliente: r.idcliente,
                        top_n: 3,
                        alert_vendedores: true
                    }, { timeout: 25_000 });
                    console.log(`[recs-scheduler] OK cliente ${r.idcliente} (${r.reason})`);
                } catch (e) {
                    console.error(`[recs-scheduler] fallo cliente ${r.idcliente}:`, (e as any)?.message || e);
                }
            }

            console.log(`[recs-scheduler] run end | processed=${filtered.length}`);
        } catch (err) {
            console.error('[recs-scheduler] error:', err);
        }
    }, { timezone: TZ });

    console.log(`[recs-scheduler] programado ${RUN_AT_CRON} TZ=${TZ} enabled=${ENABLED}`);
}
