const express = require('express');
const router = express.Router();
const pool = require('../db');

// 1. GET /api/eventos - Listar eventos con Filtros Cruzados
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
    if (empleado_id) {
      queryText += ` AND ev.empleado_id = $${paramIndex}`;
      values.push(empleado_id);
      paramIndex++;
    }
    if (tipo_evento_id) {
      queryText += ` AND ev.tipo_evento_id = $${paramIndex}`;
      values.push(tipo_evento_id);
      paramIndex++;
    }
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

// 2. POST /api/eventos - Registrar Evento + Auditoría
router.post('/', async (req, res) => {
  const client = await pool.connect();
  try {
    const { empleado_id, tipo_evento_id, descripcion, resolucion, creado_por_usuario_id } = req.body;

    if (!empleado_id || !tipo_evento_id || !descripcion || !creado_por_usuario_id) {
      return res.status(400).json({
        status: 'error',
        message: 'Los campos empleado_id, tipo_evento_id, descripcion y creado_por_usuario_id son obligatorios'
      });
    }

    await client.query('BEGIN');

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

    // Registro de Auditoría
    const auditQuery = `
      INSERT INTO historial_auditoria (usuario_id, accion, evento_id, detalles)
      VALUES ($1, $2, $3, $4)
    `;
    await client.query(auditQuery, [
      creado_por_usuario_id,
      'CREAR_EVENTO',
      nuevoEvento.id,
      `Nuevo evento ID #${nuevoEvento.id} registrado para empleado ID ${empleado_id}: ${descripcion}`
    ]);

    await client.query('COMMIT');

    res.status(201).json({
      status: 'success',
      message: 'Evento registrado con éxito en el sistema',
      data: nuevoEvento
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al registrar evento:', error);
    res.status(500).json({ status: 'error', message: 'Error en el servidor al guardar el evento' });
  } finally {
    client.release();
  }
});

// 3. PUT /api/eventos/:id - Editar Evento + Auditoría
router.put('/:id', async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { empleado_id, tipo_evento_id, descripcion, resolucion, modificado_por_usuario_id } = req.body;

    if (!modificado_por_usuario_id) {
      return res.status(400).json({ status: 'error', message: 'ID del usuario modificador es requerido' });
    }

    await client.query('BEGIN');

    // Consultar estado previo para detalle de auditoría
    const prevRes = await client.query('SELECT * FROM eventos WHERE id = $1', [id]);
    if (prevRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ status: 'error', message: 'Evento no encontrado' });
    }
    const eventoPrevio = prevRes.rows[0];

    const updateQuery = `
      UPDATE eventos
      SET 
        empleado_id = $1,
        tipo_evento_id = $2,
        descripcion = $3,
        resolucion = $4,
        modificado_por_usuario_id = $5,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $6
      RETURNING *
    `;

    const result = await client.query(updateQuery, [
      empleado_id,
      tipo_evento_id,
      descripcion,
      resolucion || null,
      modificado_por_usuario_id,
      id
    ]);

    // Registro de Auditoría de Edición
    const auditDetails = `Evento ID #${id} editado. Descripción previa: "${eventoPrevio.descripcion}" -> Nueva: "${descripcion}"`;
    await client.query(
      'INSERT INTO historial_auditoria (usuario_id, accion, evento_id, detalles) VALUES ($1, $2, $3, $4)',
      [modificado_por_usuario_id, 'EDITAR_EVENTO', id, auditDetails]
    );

    await client.query('COMMIT');

    res.json({
      status: 'success',
      message: 'Evento actualizado exitosamente',
      data: result.rows[0]
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al editar evento:', error);
    res.status(500).json({ status: 'error', message: 'Error en el servidor al editar evento' });
  } finally {
    client.release();
  }
});

// 4. DELETE /api/eventos/:id - Eliminar Evento + Auditoría
router.delete('/:id', async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { usuario_id } = req.query; // ID de quien solicita el borrado

    await client.query('BEGIN');

    // Obtener detalles antes del borrado
    const prevRes = await client.query('SELECT e.*, emp.nombre_completo FROM eventos e JOIN empleados emp ON e.empleado_id = emp.id WHERE e.id = $1', [id]);
    if (prevRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ status: 'error', message: 'Evento no encontrado' });
    }
    const evento = prevRes.rows[0];

    // Eliminar Evento (Cascade borrará archivos_evento)
    await client.query('DELETE FROM eventos WHERE id = $1', [id]);

    // Registro de Auditoría de Eliminación
    if (usuario_id) {
      await client.query(
        'INSERT INTO historial_auditoria (usuario_id, accion, detalles) VALUES ($1, $2, $3)',
        [usuario_id, 'ELIMINAR_EVENTO', `Evento ID #${id} perteneciente al empleado ${evento.nombre_completo} fue ELIMINADO del sistema.`]
      );
    }

    await client.query('COMMIT');

    res.json({
      status: 'success',
      message: 'Evento eliminado exitosamente del sistema'
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al eliminar evento:', error);
    res.status(500).json({ status: 'error', message: 'Error en el servidor al eliminar evento' });
  } finally {
    client.release();
  }
});

// 5. GET /api/eventos/auditoria - Historial de Auditoría
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
