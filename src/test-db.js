const pool = require('./db');

async function testConnection() {
  try {
    console.log('🔍 Probando conexión a la base de datos PostgreSQL...');
    
    // 1. Obtener la hora actual del servidor PostgreSQL
    const timeResult = await pool.query('SELECT NOW() AS fecha_servidor');
    console.log('⏰ Hora en el servidor PostgreSQL:', timeResult.rows[0].fecha_servidor);

    // 2. Verificar datos iniciales de estados civiles
    const estadosRes = await pool.query('SELECT * FROM estados_civiles');
    console.log('\n💍 Estados Civiles cargados (Seed Data):');
    console.table(estadosRes.rows);

    // 3. Verificar datos iniciales de tipos de evento
    const tiposRes = await pool.query('SELECT id, etiqueta, descripcion FROM tipos_evento');
    console.log('\n🏷️  Tipos de Evento cargados (Seed Data):');
    console.table(tiposRes.rows);

    // 4. Verificar usuario administrador inicial
    const usuariosRes = await pool.query('SELECT id, nombre_usuario, email, rol, created_at FROM usuarios');
    console.log('\n👤 Usuarios registrados:');
    console.table(usuariosRes.rows);

    console.log('\n🎉 ¡La base de datos está activa, configurada y funcionando perfectamente!');
  } catch (err) {
    console.error('❌ Error durante la prueba de conexión:', err.message);
    console.error('👉 Asegúrate de que el contenedor de Docker esté iniciado ("docker compose up -d").');
  } finally {
    await pool.end();
  }
}

testConnection();
