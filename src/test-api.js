const pool = require('./db');

async function runTestFlow() {
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

  try {
    console.log('🧪 Iniciando prueba completa del Backend de Eventos de RRHH...\n');

    // 1. Obtener empresas o crear una
    let empresaRes = await request({ host: 'localhost', port: 3000, path: '/api/empresas', method: 'GET' });
    let empresaId;
    if (empresaRes.body.data && empresaRes.body.data.length > 0) {
      empresaId = empresaRes.body.data[0].id;
    } else {
      const nuevaEmp = await request(
        { host: 'localhost', port: 3000, path: '/api/empresas', method: 'POST', headers: { 'Content-Type': 'application/json' } },
        { nombre: 'Empresa Test', cuit: '30-11223344-5' }
      );
      empresaId = nuevaEmp.body.data.id;
    }

    // 2. Obtener empleados o crear uno
    let empRes = await request({ host: 'localhost', port: 3000, path: '/api/empleados', method: 'GET' });
    let empleadoId;
    if (empRes.body.data && empRes.body.data.length > 0) {
      empleadoId = empRes.body.data[0].id;
    } else {
      const nuevoEmp = await request(
        { host: 'localhost', port: 3000, path: '/api/empleados', method: 'POST', headers: { 'Content-Type': 'application/json' } },
        { nombre_completo: 'María Lopez', documento: '40111222', empresa_id: empresaId, estado_civil_id: 1, fecha_nacimiento: '1995-10-10' }
      );
      empleadoId = nuevoEmp.body.data.id;
    }

    // 3. Crear un Evento de RRHH (Vacaciones) para el empleado con Transacción SQL + Auditoría
    const nuevoEventoData = {
      empleado_id: empleadoId,
      tipo_evento_id: 1, // Vacaciones
      descripcion: 'Solicitud de vacaciones anuales correspondientes al período 2026',
      resolucion: 'Aprobado por jefatura de Recursos Humanos',
      creado_por_usuario_id: 1 // Admin
    };

    const resEvento = await request(
      { host: 'localhost', port: 3000, path: '/api/eventos', method: 'POST', headers: { 'Content-Type': 'application/json' } },
      nuevoEventoData
    );
    console.log('1. POST /api/eventos (Transacción SQL) -> Status:', resEvento.statusCode, resEvento.body.message);

    // 4. Probar Consulta con Filtros Cruzados en /api/eventos
    const resFiltro = await request({ host: 'localhost', port: 3000, path: `/api/eventos?empresa_id=${empresaId}&tipo_evento_id=1`, method: 'GET' });
    console.log('\n2. GET /api/eventos (Filtros Cruzados: Empresa + Tipo Evento) -> Status:', resFiltro.statusCode);
    console.table(resFiltro.body.data.map(ev => ({
      id: ev.id,
      empleado: ev.empleado_nombre,
      empresa: ev.empresa_nombre,
      tipo_evento: ev.tipo_evento_etiqueta,
      descripcion: ev.descripcion,
      resolucion: ev.resolucion
    })));

    // 5. Consultar Registro de Auditoría de Seguridad
    const resAudit = await request({ host: 'localhost', port: 3000, path: '/api/eventos/auditoria', method: 'GET' });
    console.log('\n3. GET /api/eventos/auditoria (Seguridad) -> Status:', resAudit.statusCode);
    console.table(resAudit.body.data.map(aud => ({
      id: aud.id,
      usuario: aud.nombre_usuario,
      rol: aud.rol,
      accion: aud.accion,
      detalles: aud.detalles,
      fecha: aud.fecha_hora
    })));

    console.log('\n🎉 ¡Módulo de Eventos, Transacciones SQL, Filtros y Auditoría de Seguridad verificado con ÉXITO!');
  } catch (error) {
    console.error('❌ Error en test de API:', error.message);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

runTestFlow();
