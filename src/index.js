const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();
const pool = require('./db');

// Importar Enrutadores
const empresasRouter = require('./routes/empresas');
const empleadosRouter = require('./routes/empleados');
const catalogosRouter = require('./routes/catalogos');
const eventosRouter = require('./routes/eventos');
const authRouter = require('./routes/auth');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares globales
app.use(cors());
app.use(express.json());

// Servir archivos estáticos del Frontend y descargas/subidas multimedia
app.use(express.static(path.join(__dirname, '../')));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Ruta de prueba de salud (Health Check)
app.get('/api/health', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW() as db_time');
    res.json({
      status: 'OK',
      message: 'API del Gestor de Eventos de RRHH activa y conectada a PostgreSQL',
      db_time: result.rows[0].db_time
    });
  } catch (error) {
    console.error('Error en /api/health:', error);
    res.status(500).json({ status: 'ERROR', message: error.message });
  }
});

// Registrar Rutas de la API
app.use('/api/auth', authRouter);
app.use('/api/empresas', empresasRouter);
app.use('/api/empleados', empleadosRouter);
app.use('/api/catalogos', catalogosRouter);
app.use('/api/eventos', eventosRouter);

// Servir la aplicación Web en la raíz /
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../index.html'));
});

// Iniciar Servidor Express
app.listen(PORT, () => {
  console.log(`🚀 Servidor Web y API ejecutándose en http://localhost:${PORT}`);
  console.log(`🩺 Endpoint de prueba: http://localhost:${PORT}/api/health`);
});
