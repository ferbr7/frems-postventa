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

ALTER TABLE productos
ADD COLUMN IF NOT EXISTS fechamod timestamptz NOT NULL DEFAULT now();

CREATE OR REPLACE FUNCTION set_productos_fechamod() RETURNS trigger AS $$
BEGIN
  NEW.fechamod := now();
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_productos_fechamod ON productos;
CREATE TRIGGER trg_productos_fechamod
BEFORE UPDATE ON productos
FOR EACH ROW EXECUTE FUNCTION set_productos_fechamod();

-- C) backfill por si hay NULLs (por si la columna ya existía)
UPDATE productos SET fechamod = COALESCE(fechamod, now());

CREATE TABLE IF NOT EXISTS inventario_entradas (
  identrada     SERIAL PRIMARY KEY,
  idproducto    INT NOT NULL REFERENCES productos(idproducto) ON UPDATE CASCADE ON DELETE RESTRICT,
  idusuario     INT REFERENCES usuarios(idusuario) ON UPDATE CASCADE ON DELETE SET NULL,
  cantidad      INT NOT NULL CHECK (cantidad > 0),
  preciocosto   NUMERIC(12,2) NOT NULL CHECK (preciocosto >= 0),
  fechaentrada  DATE NOT NULL DEFAULT CURRENT_DATE,
  proveedor     VARCHAR(120)
);

-- Índices útiles
CREATE INDEX IF NOT EXISTS idx_inv_ent_idproducto   ON inventario_entradas (idproducto);
CREATE INDEX IF NOT EXISTS idx_inv_ent_fecha        ON inventario_entradas (fechaentrada);
CREATE INDEX IF NOT EXISTS idx_inv_ent_idusuario    ON inventario_entradas (idusuario);

CREATE UNIQUE INDEX IF NOT EXISTS productos_sku_lower_key
  ON productos (LOWER(sku)); 

CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_productos_nombre_trgm
  ON productos USING GIN (nombre gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_productos_categoria ON productos (categoria);
CREATE INDEX IF NOT EXISTS idx_productos_activos ON productos (idproducto) WHERE activo IS TRUE;



INSERT INTO roles (nombre, descripcion) VALUES ('admin','Tiene acceso total al sistema, incluyendo la gestión de usuarios, productos y ventas'), ('vendedor','Puede gestionar clientes, registrar ventas y consultar recomendaciones IA');

Select * from usuarios;
select * from roles;
select * from clientes;


-- Creación de indices tabla usuarios

CREATE INDEX IF NOT EXISTS idx_usuarios_idrol    ON usuarios (idrol);
CREATE INDEX IF NOT EXISTS idx_usuarios_activo   ON usuarios (activo);

-- Creación de indices tabla clientes
CREATE INDEX IF NOT EXISTS idx_clientes_telefono ON clientes (telefono);
CREATE INDEX IF NOT EXISTS idx_clientes_apellido_nombre ON clientes (apellido, nombre);
CREATE INDEX IF NOT EXISTS idx_clientes_fechaIngreso ON clientes (fechaIngreso);
CREATE INDEX IF NOT EXISTS idx_clientes_ultimaCompra ON clientes (ultimaCompra);


SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'roles';


SELECT i.indexrelid::regclass AS index,
       s.idx_scan, s.idx_tup_read, s.idx_tup_fetch
FROM pg_stat_user_indexes s
JOIN pg_class t ON t.oid = s.relid
JOIN pg_class i ON i.oid = s.indexrelid
WHERE t.relname = 'usuarios'
ORDER BY s.idx_scan DESC;

select * from inventario_entradas;
update inventario_entradas set fechaentrada = '2025-09-30'

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

