import cron from 'node-cron';
import axios from 'axios';
import prisma from './prisma';

type Reason = 'cycle' | 'dormant' | 'no_purchases_old' | 'no_purchases';

const API_BASE = process.env.API_BASE || 'http://localhost:4000';
const ENABLED = String(process.env.RECS_AUTO_ENABLED || 'false') === 'true';

const DAILY_LIMIT = Number(process.env.RECS_DAILY_LIMIT || 20);
const COOLDOWN_DAYS_ALL = Number(process.env.RECS_COOLDOWN_DAYS || 14);
const RUN_AT_CRON = process.env.RECS_RUN_AT_CRON || '19 20 * * *';
const TZ = process.env.RECS_TZ || 'America/Guatemala';

// NUEVO: control de correos desde el cron
const CRON_ALERT = String(process.env.CRON_ALERT_VENDEDORES || 'true') === 'true';

const REASONS = (process.env.RECS_AUTO_REASONS || 'cycle,dormant,no_purchases_old,no_purchases')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean) as Reason[];

// pequeño helper para espaciar requests
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

export function startRecsScheduler() {
  if (!ENABLED) {
    console.log('[recs-scheduler] deshabilitado (RECS_AUTO_ENABLED=false)');
    return;
  }

  cron.schedule(
    RUN_AT_CRON,
    async () => {
      console.log('[recs-scheduler] run start');
      try {
        // 1) refrescar MV (ignorar si no existe)
        try {
          await prisma.$executeRawUnsafe(`REFRESH MATERIALIZED VIEW rec_candidates_daily;`);
        } catch (e) {
          console.warn('[recs-scheduler] no se pudo refrescar MV rec_candidates_daily:', (e as any)?.message || e);
        }

        // 2) leer candidatos
        const rows = await prisma.$queryRawUnsafe<Array<{ idcliente: number; reason: Reason }>>(
          `SELECT idcliente, reason FROM rec_candidates_daily`
        );

        // 3) filtrar por motivos permitidos
        let candidates = rows.filter(r => REASONS.includes(r.reason));

        // 4) cooldown: evitar clientes con recomendación reciente (pendiente/enviada)
        const since = new Date();
        since.setUTCDate(since.getUTCDate() - COOLDOWN_DAYS_ALL);

        const filtered: Array<{ idcliente: number; reason: Reason }> = [];
        for (const r of candidates) {
          const recent = await prisma.recomendaciones.findFirst({
            where: {
              idcliente: r.idcliente,
              fechageneracion: { gte: since },
              estado: { in: ['pendiente', 'enviada'] }, // <-- FIX: 'enviada' (antes 'enviado')
            },
            select: { idrecomendacion: true },
          });
          if (!recent) filtered.push(r);
          if (filtered.length >= DAILY_LIMIT) break;
        }

        // 5) generar (usando tu endpoint) con alert_vendedores según flag
        let processed = 0;
        for (const r of filtered) {
          try {
            await axios.post(
              `${API_BASE}/api/recs/generate`,
              {
                idcliente: r.idcliente,
                top_n: 3,
                alert_vendedores: CRON_ALERT, // <-- control centralizado
              },
              { timeout: 25_000 }
            );
            processed++;
            console.log(`[recs-scheduler] OK cliente ${r.idcliente} (${r.reason})`);
          } catch (e) {
            console.error(`[recs-scheduler] fallo cliente ${r.idcliente}:`, (e as any)?.message || e);
          }

          // Jitter entre requests para no saturar SMTP / API
          await sleep(250 + Math.floor(Math.random() * 250)); // 250–500ms
        }

        console.log(`[recs-scheduler] run end | processed=${processed} of ${filtered.length}`);
      } catch (err) {
        console.error('[recs-scheduler] error:', err);
      }
    },
    { timezone: TZ }
  );

  console.log(`[recs-scheduler] programado ${RUN_AT_CRON} TZ=${TZ} enabled=${ENABLED} alert=${CRON_ALERT}`);
}
