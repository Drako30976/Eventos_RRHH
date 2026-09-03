const express = require('express');
const router = express.Router();
const pool = require('../db');

// 1. GET /api/empresas - Obtener todas las empresas
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM empresas ORDER BY nombre ASC');
    res.json({
      status: 'success',
      data: result.rows
    });
  } catch (error) {
    console.error('Error al obtener empresas:', error);
    res.status(500).json({ status: 'error', message: 'Error en el servidor al consultar empresas' });
  }
});

// 2. GET /api/empresas/:id - Obtener una empresa por su ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM empresas WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Empresa no encontrada' });
    }

    res.json({
      status: 'success',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error al obtener la empresa:', error);
    res.status(500).json({ status: 'error', message: 'Error en el servidor al consultar la empresa' });
  }
});

// 3. POST /api/empresas - Crear una nueva empresa
router.post('/', async (req, res) => {
  try {
    const { nombre, cuit, logo_url } = req.body;

    // Validación básica de campos obligatorios
    if (!nombre || !cuit) {
      return res.status(400).json({ status: 'error', message: 'El nombre y el CUIT son obligatorios' });
    }

    const queryText = `
      INSERT INTO empresas (nombre, cuit, logo_url)
      VALUES ($1, $2, $3)
      RETURNING *
    `;
    const values = [nombre, cuit, logo_url || null];

    const result = await pool.query(queryText, values);

    res.status(201).json({
      status: 'success',
      message: 'Empresa registrada exitosamente',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error al registrar empresa:', error);
    
    // Código de error de PostgreSQL para valor duplicado (Unique Constraint Violation)
    if (error.code === '23505') {
      return res.status(400).json({ status: 'error', message: 'Ya existe una empresa registrada con ese CUIT' });
    }

    res.status(500).json({ status: 'error', message: 'Error en el servidor al registrar empresa' });
  }
});

// 4. PUT /api/empresas/:id - Actualizar datos de una empresa
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, cuit, logo_url } = req.body;

    if (!nombre || !cuit) {
      return res.status(400).json({ status: 'error', message: 'El nombre y el CUIT son obligatorios' });
    }

    const queryText = `
      UPDATE empresas 
      SET nombre = $1, cuit = $2, logo_url = $3
      WHERE id = $4
      RETURNING *
    `;
    const values = [nombre, cuit, logo_url || null, id];

    const result = await pool.query(queryText, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Empresa no encontrada' });
    }

    res.json({
      status: 'success',
      message: 'Empresa actualizada exitosamente',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error al actualizar empresa:', error);
    if (error.code === '23505') {
      return res.status(400).json({ status: 'error', message: 'El CUIT ingresado ya le pertenece a otra empresa' });
    }
    res.status(500).json({ status: 'error', message: 'Error en el servidor al actualizar empresa' });
  }
});

// 5. DELETE /api/empresas/:id - Eliminar una empresa
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM empresas WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Empresa no encontrada' });
    }

    res.json({
      status: 'success',
      message: 'Empresa eliminada exitosamente'
    });
  } catch (error) {
    console.error('Error al eliminar empresa:', error);

    // Código 23503: Foreign Key Constraint Violation (Hay empleados asignados a esta empresa)
    if (error.code === '23503') {
      return res.status(400).json({ 
        status: 'error', 
        message: 'No se puede eliminar la empresa porque existen empleados registrados pertenecientes a ella.' 
      });
    }

    res.status(500).json({ status: 'error', message: 'Error en el servidor al eliminar empresa' });
  }
});

module.exports = router;
