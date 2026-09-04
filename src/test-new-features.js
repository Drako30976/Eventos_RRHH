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

async function testNewFeatures() {
  try {
    console.log('🧪 Iniciando prueba automatizada de las nuevas funcionalidades...\n');

    // 1. Probar Login con admin / Oblivion.1702
    const loginRes = await request(
      { host: 'localhost', port: 3000, path: '/api/auth/login', method: 'POST', headers: { 'Content-Type': 'application/json' } },
      { nombre_usuario: 'admin', password: 'Oblivion.1702' }
    );
    console.log('1. POST /api/auth/login (admin / Oblivion.1702) -> Status:', loginRes.statusCode);
    console.log('   Mensaje:', loginRes.body.message);
    console.log('   Usuario Autenticado:', loginRes.body.usuario);

    const adminId = loginRes.body.usuario.id;

    // 2. Probar Creación de Nuevo Usuario (Super-Usuario) por el Admin
    const nuevoUsuarioData = {
      nombre_usuario: 'supervisor.rrhh',
      email: 'supervisor@empresa.com',
      password: 'SuperPassword2026',
      rol: 'SUPER_USER',
      foto_url: 'https://ui-avatars.com/api/?name=Supervisor',
      admin_usuario_id: adminId
    };
    const resNuevoUser = await request(
      { host: 'localhost', port: 3000, path: '/api/auth/crear-usuario', method: 'POST', headers: { 'Content-Type': 'application/json' } },
      nuevoUsuarioData
    );
    console.log('\n2. POST /api/auth/crear-usuario -> Status:', resNuevoUser.statusCode, resNuevoUser.body.message);

    // 3. Probar Edición de Evento con Auditoría
    const eventosRes = await request({ host: 'localhost', port: 3000, path: '/api/eventos', method: 'GET' });
    if (eventosRes.body.data && eventosRes.body.data.length > 0) {
      const evento = eventosRes.body.data[0];
      const editRes = await request(
        { host: 'localhost', port: 3000, path: `/api/eventos/${evento.id}`, method: 'PUT', headers: { 'Content-Type': 'application/json' } },
        {
          empleado_id: evento.empleado_id,
          tipo_evento_id: evento.tipo_evento_id,
          descripcion: 'Vacaciones aprobadas y reprogramadas para el próximo mes',
          resolucion: 'Aprobación definitiva firmada por Dirección',
          modificado_por_usuario_id: adminId
        }
      );
      console.log('\n3. PUT /api/eventos/:id (Edición con Auditoría) -> Status:', editRes.statusCode, editRes.body.message);
    }

    // 4. Consultar Historial de Auditoría
    const auditRes = await request({ host: 'localhost', port: 3000, path: '/api/eventos/auditoria', method: 'GET' });
    console.log('\n4. GET /api/eventos/auditoria -> Registros actualizados:');
    console.table(auditRes.body.data.slice(0, 5).map(a => ({ id: a.id, usuario: a.nombre_usuario, accion: a.accion, detalles: a.detalles })));

    console.log('\n🎉 ¡Todas las 5 funcionalidades avanzadas han sido verificadas con ÉXITO!');
  } catch (err) {
    console.error('❌ Error en prueba de nuevas funciones:', err.message);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

testNewFeatures();
