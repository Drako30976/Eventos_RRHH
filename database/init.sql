-- =========================================================
-- ESQUEMA INICIAL DE BASE DE DATOS POSTGRESQL - EVENTOS_RRHH
-- =========================================================

-- 1. TABLA: usuarios (Acceso y roles de plataforma)
CREATE TABLE IF NOT EXISTS usuarios (
    id SERIAL PRIMARY KEY,
    nombre_usuario VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    rol VARCHAR(20) NOT NULL CHECK (rol IN ('ADMIN', 'SUPER_USER', 'USER')),
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. TABLA: empresas
CREATE TABLE IF NOT EXISTS empresas (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    cuit VARCHAR(20) NOT NULL UNIQUE,
    logo_url VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 3. TABLA: estados_civiles
CREATE TABLE IF NOT EXISTS estados_civiles (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL UNIQUE
);

-- 4. TABLA: empleados
CREATE TABLE IF NOT EXISTS empleados (
    id SERIAL PRIMARY KEY,
    nombre_completo VARCHAR(150) NOT NULL,
    documento VARCHAR(20) NOT NULL UNIQUE,
    numero_legajo VARCHAR(20) UNIQUE,
    empresa_id INT NOT NULL REFERENCES empresas(id) ON DELETE RESTRICT,
    estado_civil_id INT NOT NULL REFERENCES estados_civiles(id) ON DELETE RESTRICT,
    fecha_nacimiento DATE NOT NULL,
    fecha_ingreso DATE,
    foto_url VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 5. TABLA: tipos_evento
CREATE TABLE IF NOT EXISTS tipos_evento (
    id SERIAL PRIMARY KEY,
    etiqueta VARCHAR(50) NOT NULL UNIQUE,
    descripcion TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 6. TABLA: eventos (Registro de novedades/sucesos)
CREATE TABLE IF NOT EXISTS eventos (
    id SERIAL PRIMARY KEY,
    fecha_registro TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    empleado_id INT NOT NULL REFERENCES empleados(id) ON DELETE CASCADE,
    tipo_evento_id INT NOT NULL REFERENCES tipos_evento(id) ON DELETE RESTRICT,
    descripcion VARCHAR(250) NOT NULL,
    resolucion VARCHAR(150),
    creado_por_usuario_id INT NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
    modificado_por_usuario_id INT REFERENCES usuarios(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 7. TABLA: archivos_evento (Multimedia adjunto a eventos)
CREATE TABLE IF NOT EXISTS archivos_evento (
    id SERIAL PRIMARY KEY,
    evento_id INT NOT NULL REFERENCES eventos(id) ON DELETE CASCADE,
    archivo_url VARCHAR(255) NOT NULL,
    tipo_archivo VARCHAR(50),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 8. TABLA: historial_auditoria (Registro de seguridad)
CREATE TABLE IF NOT EXISTS historial_auditoria (
    id SERIAL PRIMARY KEY,
    usuario_id INT NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
    accion VARCHAR(50) NOT NULL,
    evento_id INT REFERENCES eventos(id) ON DELETE SET NULL,
    detalles TEXT,
    fecha_hora TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- =========================================================
-- DATOS INICIALES DE PRUEBA (SEED DATA)
-- =========================================================

-- Estados civiles base
INSERT INTO estados_civiles (nombre) VALUES
    ('Soltero/a'),
    ('Casado/a'),
    ('Divorciado/a'),
    ('Viudo/a'),
    ('Conviviente / Unión Civil')
ON CONFLICT (nombre) DO NOTHING;

-- Tipos de evento base
INSERT INTO tipos_evento (etiqueta, descripcion) VALUES
    ('Vacaciones', 'Período de descanso anual remunerado'),
    ('Licencia Médica', 'Ausencia justificada por enfermedad o accidente con certificado'),
    ('Licencia Familiar / Maternidad / Paternidad', 'Licencia especial por nacimiento, matrimonio o fallecimiento familiar'),
    ('Falta Injustificada', 'Ausencia del empleado sin aviso ni justificación válida'),
    ('Trámite Legal / Personal', 'Permiso para realización de trámites legales o citaciones'),
    ('Capacitación / Evento Corporal', 'Asistencia a cursos, talleres o actividades corporativas')
ON CONFLICT (etiqueta) DO NOTHING;

-- Usuario administrador por defecto (password hash provisional para pruebas)
INSERT INTO usuarios (nombre_usuario, email, password_hash, rol) VALUES
    ('admin', 'admin@eventosrrhh.local', 'admin123_hash_provisional', 'ADMIN')
ON CONFLICT (nombre_usuario) DO NOTHING;
