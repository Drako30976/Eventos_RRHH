const express = require('express');
const router = express.Router();
const pool = require('../db');

// 1. GET /api/empleados - Obtener todos los empleados (con información de empresa y estado civil)
router.get('/', async (req, res) => {
  try {
    const queryText = `
      SELECT 
        e.id,
        e.nombre_completo,
        e.documento,
        e.numero_legajo,
        e.fecha_nacimiento,
        e.fecha_ingreso,
        e.foto_url,
        e.created_at,
        emp.id AS empresa_id,
        emp.nombre AS empresa_nombre,
        ec.id AS estado_civil_id,
        ec.nombre AS estado_civil_nombre
      FROM empleados e
      JOIN empresas emp ON e.empresa_id = emp.id
      JOIN estados_civiles ec ON e.estado_civil_id = ec.id
      ORDER BY e.nombre_completo ASC
    `;
    const result = await pool.query(queryText);
    res.json({
      status: 'success',
      data: result.rows
    });
  } catch (error) {
    console.error('Error al obtener empleados:', error);
    res.status(500).json({ status: 'error', message: 'Error en el servidor al consultar empleados' });
  }
});

// 2. GET /api/empleados/:id - Obtener un empleado por ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const queryText = `
      SELECT 
        e.id,
        e.nombre_completo,
        e.documento,
        e.numero_legajo,
        e.fecha_nacimiento,
        e.fecha_ingreso,
        e.foto_url,
        e.created_at,
        emp.id AS empresa_id,
        emp.nombre AS empresa_nombre,
        ec.id AS estado_civil_id,
        ec.nombre AS estado_civil_nombre
      FROM empleados e
      JOIN empresas emp ON e.empresa_id = emp.id
      JOIN estados_civiles ec ON e.estado_civil_id = ec.id
      WHERE e.id = $1
    `;
    const result = await pool.query(queryText, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Empleado no encontrado' });
    }

    res.json({
      status: 'success',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error al obtener empleado:', error);
    res.status(500).json({ status: 'error', message: 'Error al consultar empleado' });
  }
});

// 3. POST /api/empleados - Crear un nuevo empleado
router.post('/', async (req, res) => {
  try {
    const {
      nombre_completo,
      documento,
      numero_legajo,
      empresa_id,
      estado_civil_id,
      fecha_nacimiento,
      fecha_ingreso,
      foto_url
    } = req.body;

    // Validaciones de campos obligatorios
    if (!nombre_completo || !documento || !empresa_id || !estado_civil_id || !fecha_nacimiento) {
      return res.status(400).json({
        status: 'error',
        message: 'Los campos nombre_completo, documento, empresa_id, estado_civil_id y fecha_nacimiento son obligatorios'
      });
    }

    const queryText = `
      INSERT INTO empleados 
        (nombre_completo, documento, numero_legajo, empresa_id, estado_civil_id, fecha_nacimiento, fecha_ingreso, foto_url)
      VALUES 
        ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;

    const values = [
      nombre_completo,
      documento,
      numero_legajo || null,
      empresa_id,
      estado_civil_id,
      fecha_nacimiento,
      fecha_ingreso || null,
      foto_url || null
    ];

    const result = await pool.query(queryText, values);

    res.status(201).json({
      status: 'success',
      message: 'Empleado registrado exitosamente',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error al registrar empleado:', error);

    // Violación de restricción UNIQUE (Documento o Legajo duplicado)
    if (error.code === '23505') {
      return res.status(400).json({
        status: 'error',
        message: 'Ya existe un empleado registrado con ese documento o número de legajo'
      });
    }

    // Violación de clave foránea (empresa_id o estado_civil_id inexistente)
    if (error.code === '23503') {
      return res.status(400).json({
        status: 'error',
        message: 'La empresa o el estado civil seleccionado no existen en el sistema'
      });
    }

    res.status(500).json({ status: 'error', message: 'Error en el servidor al registrar empleado' });
  }
});

// 4. PUT /api/empleados/:id - Actualizar datos de un empleado
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      nombre_completo,
      documento,
      numero_legajo,
      empresa_id,
      estado_civil_id,
      fecha_nacimiento,
      fecha_ingreso,
      foto_url
    } = req.body;

    const queryText = `
      UPDATE empleados
      SET 
        nombre_completo = $1,
        documento = $2,
        numero_legajo = $3,
        empresa_id = $4,
        estado_civil_id = $5,
        fecha_nacimiento = $6,
        fecha_ingreso = $7,
        foto_url = $8
      WHERE id = $9
      RETURNING *
    `;

    const values = [
      nombre_completo,
      documento,
      numero_legajo || null,
      empresa_id,
      estado_civil_id,
      fecha_nacimiento,
      fecha_ingreso || null,
      foto_url || null,
      id
    ];

    const result = await pool.query(queryText, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Empleado no encontrado' });
    }

    res.json({
      status: 'success',
      message: 'Empleado actualizado exitosamente',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error al actualizar empleado:', error);
    if (error.code === '23505') {
      return res.status(400).json({ status: 'error', message: 'El documento o número de legajo ya pertenecen a otro empleado' });
    }
    res.status(500).json({ status: 'error', message: 'Error en el servidor al actualizar empleado' });
  }
});

// 5. DELETE /api/empleados/:id - Eliminar un empleado
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM empleados WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Empleado no encontrado' });
    }

    res.json({
      status: 'success',
      message: 'Empleado eliminado exitosamente'
    });
  } catch (error) {
    console.error('Error al eliminar empleado:', error);
    res.status(500).json({ status: 'error', message: 'Error en el servidor al eliminar empleado' });
  }
});

module.exports = router;
