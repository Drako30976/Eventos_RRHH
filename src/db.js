const { Pool } = require('pg');
require('dotenv').config();

// Configuración de la conexión con PostgreSQL usando un Pool (grupo de conexiones reutilizables)
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT, 10) || 5432,
  database: process.env.DB_NAME || 'eventos_rrhh_db',
  user: process.env.DB_USER || 'postgres_rrhh',
  password: process.env.DB_PASSWORD || 'postgres_secret_123',
});

// Evento cuando se establece una nueva conexión
pool.on('connect', () => {
  console.log('✅ Conectado exitosamente a la base de datos PostgreSQL');
});

// Evento en caso de error en el cliente
pool.on('error', (err) => {
  console.error('❌ Error en el pool de PostgreSQL:', err);
});

module.exports = pool;
