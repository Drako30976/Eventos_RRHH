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
    const result = await pool.query('SELECT * FROM tipos_evento ORDER BY etiqueta ASC');
    res.json({
      status: 'success',
      data: result.rows
    });
  } catch (error) {
    console.error('Error al consultar tipos de evento:', error);
    res.status(500).json({ status: 'error', message: 'Error al consultar tipos de evento' });
  }
});

module.exports = router;
