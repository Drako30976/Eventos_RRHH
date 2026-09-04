const { Pool } = require('pg');
require('dotenv').config();

// Detectar si la conexión es a la nube (Neon / Supabase) o a localhost (Docker)
const isCloud = process.env.DB_HOST && process.env.DB_HOST !== 'localhost' && process.env.DB_HOST !== '127.0.0.1';

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT, 10) || 5432,
  database: process.env.DB_NAME || 'eventos_rrhh_db',
  user: process.env.DB_USER || 'postgres_rrhh',
  password: process.env.DB_PASSWORD || 'postgres_secret_123',
  // Neon y las bases de datos en la nube exigen conexión segura SSL
  ssl: isCloud ? { rejectUnauthorized: false } : false
});

pool.on('connect', () => {
  console.log(`✅ Conectado exitosamente a la base de datos PostgreSQL (${isCloud ? 'Nube/Neon' : 'Local/Docker'})`);
});

pool.on('error', (err) => {
  console.error('❌ Error en el pool de PostgreSQL:', err);
});

module.exports = pool;
