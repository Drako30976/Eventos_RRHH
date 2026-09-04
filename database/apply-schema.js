const pool = require('../src/db');
const fs = require('fs');
const path = require('path');

async function applySchema() {
  try {
    console.log('🔄 Aplicando esquema SQL y actualizando contraseña de Admin en PostgreSQL...');
    const sql = fs.readFileSync(path.join(__dirname, 'init.sql'), 'utf-8');
    await pool.query(sql);
    console.log('✅ ¡Esquema y credenciales actualizados exitosamente!');
  } catch (err) {
    console.error('❌ Error aplicando esquema:', err.message);
  } finally {
    await pool.end();
  }
}

applySchema();
