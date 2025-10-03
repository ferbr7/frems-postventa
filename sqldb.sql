----- Creación de tablas -------
CREATE TABLE roles (
    idRol SERIAL PRIMARY KEY,
    nombre VARCHAR(50) UNIQUE NOT NULL,
	descripcion VARCHAR(100) NOT NULL
);

CREATE TABLE usuarios (
  idUsuario SERIAL PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  apellido VARCHAR(100) NOT NULL,
  email VARCHAR(150) UNIQUE NOT NULL,
  username VARCHAR(50) UNIQUE NOT NULL,
  password TEXT NOT NULL,
  activo BOOLEAN DEFAULT TRUE,
  fechaAlta DATE DEFAULT CURRENT_DATE,
  idRol INT REFERENCES roles(idRol)
);

CREATE TABLE clientes (
  idCliente   SERIAL PRIMARY KEY,
  nombre      VARCHAR(100) NOT NULL,
  apellido    VARCHAR(100) NOT NULL,
  email       VARCHAR(150) UNIQUE NOT NULL,
  telefono    VARCHAR(25),
  direccion   TEXT,
  fechaIngreso DATE DEFAULT CURRENT_DATE,
  ultimaCompra DATE
);

CREATE TABLE IF NOT EXISTS productos (
  idproducto             SERIAL PRIMARY KEY,
  sku                    VARCHAR(50) NOT NULL,            
  nombre                 VARCHAR(120) NOT NULL,
  descripcion            TEXT,
  categoria              VARCHAR(80),
  medida                 VARCHAR(20),                     
  precioventa            NUMERIC(12,2) NOT NULL CHECK (precioventa >= 0),
  stock                  INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  activo                 BOOLEAN NOT NULL DEFAULT TRUE, 
  duracionestimadodias   INT CHECK (duracionestimadodias IS NULL OR duracionestimadodias BETWEEN 1 AND 3650),
  fechaalta              DATE NOT NULL DEFAULT CURRENT_DATE
);

CREATE TABLE IF NOT EXISTS ventas (
  idventa       SERIAL PRIMARY KEY,
  fecha         DATE NOT NULL DEFAULT CURRENT_DATE,             -- sin zona horaria
  subtotal      NUMERIC(12,2) NOT NULL CHECK (subtotal >= 0),
  descuentot    NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (descuentot >= 0),
  total         NUMERIC(12,2) NOT NULL CHECK (total >= 0),
  notas         TEXT,
  estado        VARCHAR(20) NOT NULL DEFAULT 'registrada' 
                 CHECK (estado IN ('registrada','cancelada')),
  idcliente     INT REFERENCES clientes(idcliente) ON UPDATE CASCADE ON DELETE SET NULL,
  idusuario     INT REFERENCES usuarios(idusuario) ON UPDATE CASCADE ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ventas_detalle (
  iddetalle       SERIAL PRIMARY KEY,
  idventa         INT NOT NULL REFERENCES ventas(idventa) ON DELETE CASCADE,
  idproducto      INT NOT NULL REFERENCES productos(idproducto) ON UPDATE CASCADE,
  cantidad        INT NOT NULL CHECK (cantidad > 0),
  precio_unit     NUMERIC(12,2) NOT NULL CHECK (precio_unit >= 0),  -- precio pactado en ese momento
  desc_pct        NUMERIC(5,2)  NOT NULL DEFAULT 0 CHECK (desc_pct >= 0 AND desc_pct <= 100),
  subtotal_linea  NUMERIC(12,2) NOT NULL CHECK (subtotal_linea >= 0) -- cantidad*precio*(1-desc/100)
);

CREATE TABLE IF NOT EXISTS inventario_entradas (
  identrada     SERIAL PRIMARY KEY,
  idproducto    INT NOT NULL REFERENCES productos(idproducto) ON UPDATE CASCADE ON DELETE RESTRICT,
  idusuario     INT REFERENCES usuarios(idusuario) ON UPDATE CASCADE ON DELETE SET NULL,
  cantidad      INT NOT NULL CHECK (cantidad > 0),
  preciocosto   NUMERIC(12,2) NOT NULL CHECK (preciocosto >= 0),
  fechaentrada  DATE NOT NULL DEFAULT CURRENT_DATE,
  proveedor     VARCHAR(120)
);

CREATE TABLE IF NOT EXISTS recomendaciones (
  idrecomendacion     SERIAL PRIMARY KEY,
  idcliente           INTEGER NOT NULL REFERENCES clientes(idcliente) ON DELETE CASCADE,
  fechageneracion     TIMESTAMPTZ NOT NULL DEFAULT now(),
  model_ia            VARCHAR(80) NOT NULL DEFAULT 'gpt-4o-mini',   -- o el que uses
  justificacion       TEXT,                                          -- explicación general
  estado              VARCHAR(20) NOT NULL DEFAULT 'pendiente'
                      CHECK (estado IN ('pendiente','contactado','pospuesto','descartado','convertido')),
  next_action_at      DATE,                                          -- recontacto (posponer)
  score_total         NUMERIC(5,2) DEFAULT 0,                        -- score agregado
  converted_venta_id  INTEGER,                                       -- si se convirtió en venta luego
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS recomendaciones_detalle (
  idrecdetalle     SERIAL PRIMARY KEY,
  idrecomendacion  INTEGER NOT NULL REFERENCES recomendaciones(idrecomendacion) ON DELETE CASCADE,
  idproducto       INTEGER NOT NULL REFERENCES productos(idproducto),
  prioridad        SMALLINT NOT NULL,                -- 1,2,3...
  score            NUMERIC(5,2) NOT NULL DEFAULT 0,
  razon            TEXT,                             -- mini justificación por ítem
  UNIQUE (idrecomendacion, idproducto)
);

-------- Creación de Indices ----------

-- Indices de recomendaciones
CREATE INDEX IF NOT EXISTS idx_recs_cliente_estado ON recomendaciones(idcliente, estado);
CREATE INDEX IF NOT EXISTS idx_recs_next_action     ON recomendaciones(next_action_at);
CREATE INDEX IF NOT EXISTS idx_recs_fecha           ON recomendaciones(fechageneracion DESC);

-- Indeces para ventas
CREATE INDEX IF NOT EXISTS idx_ventas_fecha      ON ventas (fecha);
CREATE INDEX IF NOT EXISTS idx_ventas_idcliente  ON ventas (idcliente);
CREATE INDEX IF NOT EXISTS idx_ventas_idusuario  ON ventas (idusuario);

-- Indices para ventas detalle
CREATE INDEX IF NOT EXISTS idx_vdet_idventa    ON ventas_detalle (idventa);
CREATE INDEX IF NOT EXISTS idx_vdet_idproducto ON ventas_detalle (idproducto);

-- Índices para inventario
CREATE INDEX IF NOT EXISTS idx_inv_ent_idproducto   ON inventario_entradas (idproducto);
CREATE INDEX IF NOT EXISTS idx_inv_ent_fecha        ON inventario_entradas (fechaentrada);
CREATE INDEX IF NOT EXISTS idx_inv_ent_idusuario    ON inventario_entradas (idusuario);

-- Indices para productos
CREATE INDEX IF NOT EXISTS idx_productos_categoria ON productos (categoria);
CREATE INDEX IF NOT EXISTS idx_productos_activos ON productos (idproducto) WHERE activo IS TRUE;

-- Creación de indices tabla usuarios

CREATE INDEX IF NOT EXISTS idx_usuarios_idrol    ON usuarios (idrol);
CREATE INDEX IF NOT EXISTS idx_usuarios_activo   ON usuarios (activo);

-- Creación de indices tabla clientes
CREATE INDEX IF NOT EXISTS idx_clientes_telefono ON clientes (telefono);
CREATE INDEX IF NOT EXISTS idx_clientes_apellido_nombre ON clientes (apellido, nombre);
CREATE INDEX IF NOT EXISTS idx_clientes_fechaIngreso ON clientes (fechaIngreso);
CREATE INDEX IF NOT EXISTS idx_clientes_ultimaCompra ON clientes (ultimaCompra);


ALTER TABLE productos
ADD COLUMN IF NOT EXISTS fechamod timestamptz NOT NULL DEFAULT now();

--- Triger para productos
CREATE OR REPLACE FUNCTION set_productos_fechamod() RETURNS trigger AS $$
BEGIN
  NEW.fechamod := now();
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_productos_fechamod ON productos;
CREATE TRIGGER trg_productos_fechamod
BEFORE UPDATE ON productos
FOR EACH ROW EXECUTE FUNCTION set_productos_fechamod();


UPDATE productos SET fechamod = COALESCE(fechamod, now());


CREATE UNIQUE INDEX IF NOT EXISTS productos_sku_lower_key
  ON productos (LOWER(sku)); 

CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_productos_nombre_trgm
  ON productos USING GIN (nombre gin_trgm_ops);



--- Inserts para pruebas
INSERT INTO roles (nombre, descripcion) VALUES ('admin','Tiene acceso total al sistema, incluyendo la gestión de usuarios, productos y ventas'), ('vendedor','Puede gestionar clientes, registrar ventas y consultar recomendaciones IA');

INSERT INTO productos (sku, nombre, descripcion, categoria, medida, precioventa, stock, activo) VALUES
('EDP-M-050-001','Eau de Parfum Jazmín 50ml','Notas florales de jazmín y gardenia','Fragancias M','50ml',295.00,20,TRUE),
('EDP-M-100-002','Eau de Parfum Vainilla 100ml','Vainilla cálida con toque ambarado','Fragancias M','100ml',420.00,12,TRUE),
('EDT-U-100-003','Eau de Toilette Cítricos 100ml','Bergamota, limón y toques verdes','Fragancias U','100ml',260.00,18,TRUE),
('EDP-U-075-004','Eau de Parfum Ámbar 75ml','Oriental ambarado con especias suaves','Fragancias U','75ml',380.00,10,TRUE),
('MST-M-250-005','Body Mist Frutos Rojos 250ml','Bruma corporal frutal, ligera y fresca','Brumas','250ml',120.00,30,TRUE),
('CRM-M-200-006','Crema Perfumada Vainilla 200ml','Hidratante corporal con aroma a vainilla','Cremas','200ml',85.00,25,TRUE),
('SET-M-SET-007','Set Floral (EDP 50ml + Crema 100ml)','Set de regalo floral dulce','Sets','set',520.00,8,TRUE),
('EDT-H-050-008','Eau de Toilette Madera 50ml','Maderas secas con toque de vetiver','Fragancias H','50ml',240.00,15,TRUE),
('EDP-U-100-009','Eau de Parfum Oud 100ml','Oud intenso con ámbar y vainilla','Fragancias U','100ml',650.00,6,TRUE),
('EDP-M-030-010','Eau de Parfum Rosas 30ml','Bouquet de rosas con musk suave','Fragancias M','30ml',210.00,22,TRUE);

INSERT INTO recomendaciones (fechageneracion, justificacion, estado, idcliente, next_action_at)
VALUES (CURRENT_DATE, 'Semilla de prueba', 'pendiente', 1, CURRENT_DATE + INTERVAL '3 days')
RETURNING idrecomendacion;

INSERT INTO recomendaciones_detalle (idrecomendacion, idproducto, prioridad, score, razon)
VALUES
(1, 3, 1, 0.92, 'Similar a sus compras recientes'),
(1, 5, 2, 0.87, 'Misma categoría y tamaño'),
(1, 7, 3, 0.74, 'Alternativa con buen precio');

---- Select de tablas

Select * from usuarios;
select * from roles;
select * from clientes;
select * from ventas;
select * from ventas_detalle;
select * from inventario_entradas;

delete from ventas where fecha = '2025-10-02';

SELECT idcliente, COUNT(*) 
FROM ventas 
WHERE idcliente IS NOT NULL AND (estado = 'registrada' OR estado IS NULL)
GROUP BY idcliente
ORDER BY 2 DESC;

SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'roles';

SELECT i.indexrelid::regclass AS index,
       s.idx_scan, s.idx_tup_read, s.idx_tup_fetch
FROM pg_stat_user_indexes s
JOIN pg_class t ON t.oid = s.relid
JOIN pg_class i ON i.oid = s.indexrelid
WHERE t.relname = 'usuarios'
ORDER BY s.idx_scan DESC;


