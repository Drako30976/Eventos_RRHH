const express = require('express');
const router = express.Router();
const pool = require('../db');

// GET /api/catalogos/estados-civiles - Obtener todos los estados civiles
router.get('/estados-civiles', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM estados_civiles ORDER BY id ASC');
    res.json({
      status: 'success',
      data: result.rows
    });
  } catch (error) {
    console.error('Error al consultar estados civiles:', error);
    res.status(500).json({ status: 'error', message: 'Error al consultar estados civiles' });
  }
});

// GET /api/catalogos/tipos-evento - Obtener todos los tipos de evento
router.get('/tipos-evento', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM tipos_evento ORDER BY id ASC');
    res.json({
      status: 'success',
      data: result.rows
    });
  } catch (error) {
    console.error('Error al consultar tipos de evento:', error);
    res.status(500).json({ status: 'error', message: 'Error al consultar tipos de evento' });
  }
});

// POST /api/catalogos/tipos-evento - Crear un nuevo Tipo de Evento (ADMIN / SUPER_USER)
router.post('/tipos-evento', async (req, res) => {
  try {
    const { etiqueta, descripcion } = req.body;

    if (!etiqueta) {
      return res.status(400).json({ status: 'error', message: 'La etiqueta del tipo de evento es obligatoria' });
    }

    const queryText = `
      INSERT INTO tipos_evento (etiqueta, descripcion)
      VALUES ($1, $2)
      RETURNING *
    `;
    const result = await pool.query(queryText, [etiqueta, descripcion || null]);

    res.status(201).json({
      status: 'success',
      message: 'Tipo de evento creado exitosamente',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error al crear tipo de evento:', error);
    if (error.code === '23505') {
      return res.status(400).json({ status: 'error', message: 'Ya existe una etiqueta con ese nombre' });
    }
    res.status(500).json({ status: 'error', message: 'Error al registrar el tipo de evento' });
  }
});

// PUT /api/catalogos/tipos-evento/:id - Editar Tipo de Evento
router.put('/tipos-evento/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { etiqueta, descripcion } = req.body;

    if (!etiqueta) {
      return res.status(400).json({ status: 'error', message: 'La etiqueta del tipo de evento es obligatoria' });
    }

    const queryText = `
      UPDATE tipos_evento
      SET etiqueta = $1, descripcion = $2
      WHERE id = $3
      RETURNING *
    `;
    const result = await pool.query(queryText, [etiqueta, descripcion || null, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Tipo de evento no encontrado' });
    }

    res.json({
      status: 'success',
      message: 'Tipo de evento actualizado exitosamente',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error al actualizar tipo de evento:', error);
    if (error.code === '23505') {
      return res.status(400).json({ status: 'error', message: 'La etiqueta ingresada ya le pertenece a otro tipo de evento' });
    }
    res.status(500).json({ status: 'error', message: 'Error al actualizar tipo de evento' });
  }
});

// DELETE /api/catalogos/tipos-evento/:id - Eliminar Tipo de Evento
router.delete('/tipos-evento/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM tipos_evento WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Tipo de evento no encontrado' });
    }

    res.json({
      status: 'success',
      message: 'Tipo de evento eliminado exitosamente'
    });
  } catch (error) {
    console.error('Error al eliminar tipo de evento:', error);
    if (error.code === '23503') {
      return res.status(400).json({
        status: 'error',
        message: 'No se puede eliminar la etiqueta porque existen eventos registrados que la están utilizando.'
      });
    }
    res.status(500).json({ status: 'error', message: 'Error al eliminar tipo de evento' });
  }
});

module.exports = router;
