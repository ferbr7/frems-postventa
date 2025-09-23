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
  fechaAlta TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  idRol INT REFERENCES roles(idRol)
);




INSERT INTO roles (nombre, descripcion) VALUES ('admin','Tiene acceso total al sistema, incluyendo la gestión de usuarios, productos y ventas'), ('vendedor','Puede gestionar clientes, registrar ventas y consultar recomendaciones IA');

Select * from roles;
