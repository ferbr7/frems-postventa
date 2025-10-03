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
)
-- A) Patrón o duración -> “debidos” (anticipa 3 días)
SELECT DISTINCT a.idcliente, 'cycle'::text AS reason
FROM agg a
WHERE a.cycle_days IS NOT NULL
  AND (a.last_date + (a.cycle_days - 3)) <= CURRENT_DATE
  AND a.buy_count >= 1

UNION ALL
-- B) Inactivos (> 90 días desde última compra o sin última)
SELECT v.idcliente, 'dormant'
FROM (
  SELECT idcliente, MAX(fecha)::date AS last_fecha
  FROM ventas
  WHERE estado = 'registrada'
  GROUP BY idcliente
) v
WHERE v.last_fecha IS NULL
   OR v.last_fecha <= CURRENT_DATE - INTERVAL '90 days'

UNION ALL
-- C) Sin compras (jamás compraron)
SELECT c.idcliente, 'no_purchases'
FROM clientes c
WHERE NOT EXISTS (
  SELECT 1 FROM ventas v
   WHERE v.idcliente = c.idcliente
     AND v.estado = 'registrada'
);

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


SELECT *
FROM rec_candidates_daily
WHERE idcliente = 3
;