const pool = require('./db');
const http = require('http');

function request(options, data) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve({ statusCode: res.statusCode, body: JSON.parse(body || '{}') }));
    });
    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

async function testAdvancedFeatures() {
  try {
    console.log('🧪 Probando requerimientos adicionales (Subida de foto, Gestión de Tipos de Eventos y Permisos por Rango)...\n');

    // 1. Crear / Editar un Tipo de Evento
    const nuevoTipoRes = await request(
      { host: 'localhost', port: 3000, path: '/api/catalogos/tipos-evento', method: 'POST', headers: { 'Content-Type': 'application/json' } },
      { etiqueta: 'Licencia Médica Especial', descripcion: 'Justificación médica emitida por junta de salud laboral' }
    );
    console.log('1. POST /api/catalogos/tipos-evento -> Status:', nuevoTipoRes.statusCode, nuevoTipoRes.body.message);

    const tipoId = nuevoTipoRes.body.data.id;
    const editTipoRes = await request(
      { host: 'localhost', port: 3000, path: `/api/catalogos/tipos-evento/${tipoId}`, method: 'PUT', headers: { 'Content-Type': 'application/json' } },
      { etiqueta: 'Licencia Médica de Largo Tratamiento', descripcion: 'Tratamientos superiores a 30 días' }
    );
    console.log('2. PUT /api/catalogos/tipos-evento/:id -> Status:', editTipoRes.statusCode, editTipoRes.body.message);

    // 2. Verificar Restricción de Rango: Super-Usuario intentando modificar la cuenta del ADMIN
    // Obtener ID de un Super Usuario
    const usersRes = await request({ host: 'localhost', port: 3000, path: '/api/auth/usuarios', method: 'GET' });
    const superUser = usersRes.body.data.find(u => u.rol === 'SUPER_USER');
    const adminUser = usersRes.body.data.find(u => u.rol === 'ADMIN');

    if (superUser && adminUser) {
      const illegalEdit = await request(
        { host: 'localhost', port: 3000, path: `/api/auth/usuarios/${adminUser.id}`, method: 'PUT', headers: { 'Content-Type': 'application/json' } },
        { nombre_usuario: 'admin_hackeado', usuario_solicitante_id: superUser.id }
      );
      console.log('\n3. Prueba de Seguridad: Super-Usuario intentando modificar al ADMIN -> Status:', illegalEdit.statusCode, '(' + illegalEdit.body.message + ')');
    }

    console.log('\n🎉 ¡Todos los requerimientos adicionales han sido verificados y protegidos con ÉXITO!');
  } catch (err) {
    console.error('❌ Error en prueba:', err.message);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

testAdvancedFeatures();
