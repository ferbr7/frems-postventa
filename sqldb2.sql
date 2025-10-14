-- Ventas: acceso por cliente/estado/fecha
CREATE INDEX IF NOT EXISTS ix_ventas_cliente_estado_fecha
  ON ventas (idcliente, estado, fecha);

-- Ventas detalle: joins frecuentes
CREATE INDEX IF NOT EXISTS ix_ventas_detalle_idventa   ON ventas_detalle (idventa);
CREATE INDEX IF NOT EXISTS ix_ventas_detalle_producto  ON ventas_detalle (idproducto);

-- Productos: para fallback de duración
CREATE INDEX IF NOT EXISTS ix_productos_duracion ON productos (duracionestimadodias);

-- 1.1 Tabla de métricas (solo guarda productos con >= 2 compras)
CREATE TABLE IF NOT EXISTS rec_metrics (
  idcliente   INT NOT NULL REFERENCES clientes(idcliente) ON DELETE CASCADE,
  idproducto  INT NOT NULL REFERENCES productos(idproducto) ON DELETE CASCADE,
  last_date   DATE NOT NULL,
  median_days INT  NOT NULL,
  buy_count   INT  NOT NULL,
  PRIMARY KEY (idcliente, idproducto)
);

-- 1.2 Índices para consultas por “debido”
CREATE INDEX IF NOT EXISTS ix_rec_metrics_due
  ON rec_metrics (idcliente, last_date, median_days);

--- Función para recomputar métricas de un cliente
CREATE OR REPLACE FUNCTION rec_recompute_metrics_for_client(p_idcliente INT)
RETURNS VOID AS $$
DECLARE
BEGIN
  -- Diferencias de fechas por producto (solo si hay al menos 2 compras)
  WITH hist AS (
    SELECT
      d.idproducto,
      v.fecha::date AS fecha,
      LEAD(v.fecha::date) OVER (PARTITION BY d.idproducto ORDER BY v.fecha::date) AS next_fecha
    FROM ventas v
    JOIN ventas_detalle d USING (idventa)
    WHERE v.idcliente = p_idcliente
      AND v.estado   = 'registrada'
  ),
  diffs AS (
    SELECT idproducto, (next_fecha - fecha) AS diff_days
    FROM hist
    WHERE next_fecha IS NOT NULL
  ),
  metricas AS (
    SELECT
      d.idproducto,
      -- mediana de días entre compras
      (SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY diff_days)
         FROM (SELECT diff_days FROM diffs WHERE idproducto = d.idproducto) z)::int AS median_days,
      COUNT(*) AS diff_count,
      -- última fecha de compra para ese producto
      (SELECT MAX(v2.fecha)::date
         FROM ventas v2
         JOIN ventas_detalle x USING (idventa)
        WHERE v2.idcliente = p_idcliente
          AND x.idproducto = d.idproducto
          AND v2.estado    = 'registrada') AS last_date
    FROM diffs d
    GROUP BY d.idproducto
  )
  INSERT INTO rec_metrics (idcliente, idproducto, last_date, median_days, buy_count)
  SELECT
    p_idcliente,
    m.idproducto,
    COALESCE(m.last_date, CURRENT_DATE),
    GREATEST(1, m.median_days),   -- evita 0 días por robustez
    m.diff_count + 1              -- #compras = #diffs + 1
  FROM metricas m
  WHERE m.diff_count >= 1  -- asegura al menos 2 compras
  ON CONFLICT (idcliente, idproducto) DO UPDATE
     SET last_date   = EXCLUDED.last_date,
         median_days = EXCLUDED.median_days,
         buy_count   = EXCLUDED.buy_count;
END;
$$ LANGUAGE plpgsql;

--- Trigger para mantener métricas al registrar ventas

CREATE OR REPLACE FUNCTION trg_rec_metrics_after_sale()
RETURNS TRIGGER AS $$
DECLARE
  cid INT;
BEGIN
  SELECT idcliente INTO cid FROM ventas WHERE idventa = NEW.idventa;
  IF cid IS NOT NULL THEN
    PERFORM rec_recompute_metrics_for_client(cid);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS t_rec_metrics_after_sale ON ventas_detalle;
CREATE TRIGGER t_rec_metrics_after_sale
AFTER INSERT ON ventas_detalle
FOR EACH ROW
EXECUTE FUNCTION trg_rec_metrics_after_sale();

------------------------

DROP MATERIALIZED VIEW IF EXISTS rec_candidates_daily;


CREATE MATERIALIZED VIEW rec_candidates_daily AS
WITH lastp AS (
  -- Última compra por cliente-producto
  SELECT v.idcliente,
         d.idproducto,
         MAX(v.fecha)::date AS last_date
  FROM ventas v
  JOIN ventas_detalle d USING (idventa)
  WHERE v.estado = 'registrada'
  GROUP BY v.idcliente, d.idproducto
),
agg AS (
  SELECT
    lp.idcliente,
    lp.idproducto,
    lp.last_date,
    COALESCE(m.median_days, p.duracionestimadodias)::int AS cycle_days,
    COALESCE(m.buy_count, 1) AS buy_count
  FROM lastp lp
  JOIN productos p ON p.idproducto = lp.idproducto
  LEFT JOIN rec_metrics m
    ON m.idcliente = lp.idcliente AND m.idproducto = lp.idproducto
),
last_by_client AS (
  SELECT v.idcliente, MAX(v.fecha)::date AS last_fecha
  FROM ventas v
  WHERE v.estado = 'registrada'
  GROUP BY v.idcliente
),

-- A) Patrón/ciclo (anticipa 3 días)
cycle AS (
  SELECT DISTINCT a.idcliente, 1 AS prio, 'cycle'::text AS reason
  FROM agg a
  WHERE a.cycle_days IS NOT NULL
    AND (a.last_date + (a.cycle_days - 3)) <= CURRENT_DATE
    AND a.buy_count >= 1
),

-- B) Dormidos: sí tienen compras, pero la última fue hace > 90 días
dormant AS (
  SELECT l.idcliente, 2 AS prio, 'dormant'::text AS reason
  FROM last_by_client l
  WHERE l.last_fecha <= CURRENT_DATE - INTERVAL '90 days'
),

-- C) 0 compras y antigüedad > 90 días (cliente “viejo” sin compras)
no_purchases_old AS (
  SELECT c.idcliente, 3 AS prio, 'no_purchases_old'::text AS reason
  FROM clientes c
  WHERE c.fechaingreso IS NOT NULL
    AND c.fechaingreso <= CURRENT_DATE - INTERVAL '90 days'
    AND NOT EXISTS (
      SELECT 1 FROM ventas v
      WHERE v.idcliente = c.idcliente
        AND v.estado = 'registrada'
    )
),

-- D) 0 compras “nuevo” (antigüedad <= 90 días)
no_purchases AS (
  SELECT c.idcliente, 4 AS prio, 'no_purchases'::text AS reason
  FROM clientes c
  WHERE NOT EXISTS (
    SELECT 1 FROM ventas v
    WHERE v.idcliente = c.idcliente
      AND v.estado = 'registrada'
  )
  AND NOT EXISTS (
    SELECT 1 FROM no_purchases_old o WHERE o.idcliente = c.idcliente
  )
)

-- Resultado final: 1 fila por cliente (razón con mayor prioridad)
SELECT DISTINCT ON (idcliente) idcliente, reason
FROM (
  SELECT * FROM cycle
  UNION ALL
  SELECT * FROM dormant
  UNION ALL
  SELECT * FROM no_purchases_old
  UNION ALL
  SELECT * FROM no_purchases
) t
ORDER BY idcliente, prio;






-- Índice para lecturas rápidas desde backend
CREATE INDEX IF NOT EXISTS ix_rec_candidates_daily
  ON rec_candidates_daily (idcliente);

------------------------------
---Procedimiento para refrescar la MV

CREATE OR REPLACE PROCEDURE rec_refresh_candidates_daily()
LANGUAGE plpgsql
AS $$
BEGIN
  -- Si tu Postgres NO soporta CONCURRENTLY, usa la versión simple:
REFRESH MATERIALIZED VIEW rec_candidates_daily;
  --REFRESH MATERIALIZED VIEW CONCURRENTLY rec_candidates_daily;
END;
$$;

-- Habilitar la extensión (requiere permisos de superuser/parametría del servicio)
-- CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Programar el refresco a las 08:58 GT (2 minutos antes del batch en Node)
-- SELECT cron.schedule('recs_daily_refresh', '58 8 * * *', $$CALL rec_refresh_candidates_daily();$$);


-- ¿Qué candidatos hay hoy?
SELECT * FROM rec_candidates_daily ORDER BY idcliente;

-- Métricas existentes para un cliente
SELECT * FROM rec_metrics WHERE idcliente = 1 ORDER BY idproducto;

-- Fuerza recomputar métricas de un cliente concreto
SELECT rec_recompute_metrics_for_client(1);

-- Refresca manualmente la MV
CALL rec_refresh_candidates_daily();



--------------------------
-----------------------------
--------------------------

SELECT d.idproducto, p.nombre, COUNT(*) compras, MAX(v.fecha) ult_compra
FROM ventas v
JOIN ventas_detalle d ON d.idventa = v.idventa
JOIN productos p      ON p.idproducto = d.idproducto
WHERE v.idcliente = 3
GROUP BY d.idproducto, p.nombre
ORDER BY compras DESC;

REFRESH MATERIALIZED VIEW rec_candidates_daily;

select * from clientes;
SELECT *
FROM rec_candidates_daily
;
delete from clientes where idcliente = 2;

select * from recomendaciones; where idrecomendacion = 40;
delete from recomendaciones;
select * from recomendaciones_detalle;

SELECT estado, COUNT(*) FROM recomendaciones GROUP BY estado ORDER BY estado;


SELECT conname, pg_get_constraintdef(c.oid) AS def
FROM pg_constraint c
JOIN pg_class t ON c.conrelid = t.oid
WHERE t.relname = 'recomendaciones';



CREATE TABLE IF NOT EXISTS recomendaciones (
  idrecomendacion     SERIAL PRIMARY KEY,
  idcliente           INTEGER NOT NULL REFERENCES clientes(idcliente) ON DELETE CASCADE,
  fechageneracion     TIMESTAMPTZ NOT NULL DEFAULT now(),
  model_ia            VARCHAR(80) NOT NULL DEFAULT 'gpt-4o-mini',   -- o el que uses
  justificacion       TEXT,                                          -- explicación general
  estado              VARCHAR(20) NOT NULL DEFAULT 'pendiente'
                      CHECK (estado IN ('pendiente','enviada','descartada','vencida')),
  next_action_at      DATE,                                          -- recontacto (posponer)
  score_total         NUMERIC(5,2) DEFAULT 0,                        -- score agregado
  converted_venta_id  INTEGER,                                       -- si se convirtió en venta luego
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);



BEGIN;

ALTER TABLE recomendaciones DROP CONSTRAINT IF EXISTS recomendaciones_estado_check;

ALTER TABLE recomendaciones
ADD CONSTRAINT recomendaciones_estado_check
CHECK (estado IN ('pendiente','enviada','descartada','vencida'));

COMMIT;


DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'activity_type') THEN
    CREATE TYPE activity_type AS ENUM ('venta','cliente','recomendacion','tarea','otro');
  END IF;
END$$;


-- 2) Tabla actividad
CREATE TABLE IF NOT EXISTS actividad (
  id            SERIAL PRIMARY KEY,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  who_user_id   INTEGER NULL,
  what          TEXT    NOT NULL,
  type          activity_type NOT NULL DEFAULT 'otro',
  meta          JSONB   NULL,
  CONSTRAINT actividad_who_fk
    FOREIGN KEY (who_user_id)
    REFERENCES usuarios (idusuario)
    ON DELETE SET NULL
);

-- 3) Índices útiles
CREATE INDEX IF NOT EXISTS idx_actividad_created_at   ON actividad (created_at);
CREATE INDEX IF NOT EXISTS idx_actividad_who_user_id  ON actividad (who_user_id);
CREATE INDEX IF NOT EXISTS idx_actividad_type         ON actividad (type);



UPDATE usuarios
SET password = '$2b$12$NoFBmScXU14FMeOzMod9ruHc0FKNsuwEm9wTZL4g2bC58iHGEidYe'
WHERE idusuario = 2; 



Select * from usuarios;


select * from actividad;

select * from ventas;

SELECT count(*) FROM ventas
WHERE fecha >= date_trunc('day', now() AT TIME ZONE 'UTC')
  AND  fecha <  date_trunc('day', now() AT TIME ZONE 'UTC') + interval '1 day';




