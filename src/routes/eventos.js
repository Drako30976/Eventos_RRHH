const express = require('express');
const router = express.Router();
const pool = require('../db');

// 1. GET /api/eventos - Listar eventos con Filtros Cruzados (Fechas, Empleado, Tipo de Evento, Empresa)
router.get('/', async (req, res) => {
  try {
    const { fecha_desde, fecha_hasta, empleado_id, tipo_evento_id, empresa_id } = req.query;

    let queryText = `
      SELECT 
        ev.id,
        ev.fecha_registro,
        ev.descripcion,
        ev.resolucion,
        ev.created_at,
        ev.updated_at,
        emp.id AS empleado_id,
        emp.nombre_completo AS empleado_nombre,
        emp.documento AS empleado_documento,
        empresa.id AS empresa_id,
        empresa.nombre AS empresa_nombre,
        te.id AS tipo_evento_id,
        te.etiqueta AS tipo_evento_etiqueta,
        uc.nombre_usuario AS creado_por_usuario,
        um.nombre_usuario AS modificado_por_usuario
      FROM eventos ev
      JOIN empleados emp ON ev.empleado_id = emp.id
      JOIN empresas empresa ON emp.empresa_id = empresa.id
      JOIN tipos_evento te ON ev.tipo_evento_id = te.id
      JOIN usuarios uc ON ev.creado_por_usuario_id = uc.id
      LEFT JOIN usuarios um ON ev.modificado_por_usuario_id = um.id
      WHERE 1=1
    `;

    const values = [];
    let paramIndex = 1;

    // Filtro 1: Rango de Fechas
    if (fecha_desde) {
      queryText += ` AND ev.fecha_registro >= $${paramIndex}`;
      values.push(fecha_desde);
      paramIndex++;
    }
    if (fecha_hasta) {
      queryText += ` AND ev.fecha_registro <= $${paramIndex}`;
      values.push(fecha_hasta);
      paramIndex++;
    }

    // Filtro 2: Empleado específico
    if (empleado_id) {
      queryText += ` AND ev.empleado_id = $${paramIndex}`;
      values.push(empleado_id);
      paramIndex++;
    }

    // Filtro 3: Tipo de evento específico
    if (tipo_evento_id) {
      queryText += ` AND ev.tipo_evento_id = $${paramIndex}`;
      values.push(tipo_evento_id);
      paramIndex++;
    }

    // Filtro 4: Empresa específica
    if (empresa_id) {
      queryText += ` AND emp.empresa_id = $${paramIndex}`;
      values.push(empresa_id);
      paramIndex++;
    }

    queryText += ` ORDER BY ev.fecha_registro DESC`;

    const result = await pool.query(queryText, values);

    res.json({
      status: 'success',
      total: result.rows.length,
      data: result.rows
    });
  } catch (error) {
    console.error('Error al consultar eventos:', error);
    res.status(500).json({ status: 'error', message: 'Error en el servidor al consultar eventos' });
  }
});

// 2. POST /api/eventos - Registrar un nuevo Evento + Registro de Auditoría
router.post('/', async (req, res) => {
  const client = await pool.connect(); // Usamos una Transacción SQL para garantizar que evento + auditoría se guarden juntos
  try {
    const { empleado_id, tipo_evento_id, descripcion, resolucion, creado_por_usuario_id } = req.body;

    if (!empleado_id || !tipo_evento_id || !descripcion || !creado_por_usuario_id) {
      return res.status(400).json({
        status: 'error',
        message: 'Los campos empleado_id, tipo_evento_id, descripcion y creado_por_usuario_id son obligatorios'
      });
    }

    await client.query('BEGIN'); // Inicio de Transacción SQL

    // 1. Insertar Evento
    const insertEventoQuery = `
      INSERT INTO eventos (empleado_id, tipo_evento_id, descripcion, resolucion, creado_por_usuario_id)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    const eventoResult = await client.query(insertEventoQuery, [
      empleado_id,
      tipo_evento_id,
      descripcion,
      resolucion || null,
      creado_por_usuario_id
    ]);
    const nuevoEvento = eventoResult.rows[0];

    // 2. Insertar Registro de Auditoría obligatoria
    const auditQuery = `
      INSERT INTO historial_auditoria (usuario_id, accion, evento_id, detalles)
      VALUES ($1, $2, $3, $4)
    `;
    await client.query(auditQuery, [
      creado_por_usuario_id,
      'CREAR_EVENTO',
      nuevoEvento.id,
      `Evento creado para empleado ID ${empleado_id} con descripción: ${descripcion.substring(0, 50)}...`
    ]);

    await client.query('COMMIT'); // Confirmar Transacción en la BD

    res.status(201).json({
      status: 'success',
      message: 'Evento registrado con éxito en el sistema',
      data: nuevoEvento
    });
  } catch (error) {
    await client.query('ROLLBACK'); // Si algo falla, revertimos todos los cambios
    console.error('Error al registrar evento:', error);
    res.status(500).json({ status: 'error', message: 'Error en el servidor al guardar el evento' });
  } finally {
    client.release();
  }
});

// 3. GET /api/eventos/auditoria - Consultar Historial de Auditoría de Seguridad
router.get('/auditoria', async (req, res) => {
  try {
    const queryText = `
      SELECT 
        ha.id,
        ha.accion,
        ha.detalles,
        ha.fecha_hora,
        ha.evento_id,
        u.nombre_usuario,
        u.rol
      FROM historial_auditoria ha
      JOIN usuarios u ON ha.usuario_id = u.id
      ORDER BY ha.fecha_hora DESC
    `;
    const result = await pool.query(queryText);
    res.json({
      status: 'success',
      data: result.rows
    });
  } catch (error) {
    console.error('Error al consultar auditoría:', error);
    res.status(500).json({ status: 'error', message: 'Error al consultar historial de auditoría' });
  }
});

module.exports = router;
