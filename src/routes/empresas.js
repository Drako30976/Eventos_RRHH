const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const pool = require('../db');

// Configuración de Multer para subir logos de empresas
const uploadLogoDir = path.join(__dirname, '../../uploads/logos');
if (!fs.existsSync(uploadLogoDir)) {
  fs.mkdirSync(uploadLogoDir, { recursive: true });
}

const storageLogo = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadLogoDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `logo_${Date.now()}_${Math.round(Math.random() * 1e9)}${ext}`);
  }
});

const uploadLogo = multer({
  storage: storageLogo,
  limits: { fileSize: 5 * 1024 * 1024 }
});

// 1. POST /api/empresas/upload-logo - Subir imagen del logo de la empresa
router.post('/upload-logo', uploadLogo.single('logo'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ status: 'error', message: 'No se subió ninguna imagen de logo' });
    }
    const logo_url = `/uploads/logos/${req.file.filename}`;
    res.json({
      status: 'success',
      message: 'Logo subido exitosamente',
      logo_url
    });
  } catch (error) {
    console.error('Error al subir logo:', error);
    res.status(500).json({ status: 'error', message: 'Error al procesar el logo' });
  }
});

// 2. GET /api/empresas - Obtener todas las empresas
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

// 3. GET /api/empresas/:id - Obtener una empresa por ID
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

// 4. POST /api/empresas - Crear una nueva empresa
router.post('/', async (req, res) => {
  try {
    const { nombre, cuit, logo_url } = req.body;

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
    if (error.code === '23505') {
      return res.status(400).json({ status: 'error', message: 'Ya existe una empresa registrada con ese CUIT' });
    }
    res.status(500).json({ status: 'error', message: 'Error en el servidor al registrar empresa' });
  }
});

// 5. PUT /api/empresas/:id - Actualizar empresa
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

// 6. DELETE /api/empresas/:id - Eliminar empresa
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
