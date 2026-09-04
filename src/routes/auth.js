const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const pool = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'super_secreto_rrhh_clave_2026';

// Configuración de multer para subir imágenes de perfil
const uploadDir = path.join(__dirname, '../../uploads/avatars');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `avatar_${Date.now()}_${Math.round(Math.random() * 1e9)}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 } // Límite de 5MB
});

// 1. POST /api/auth/upload-avatar - Subir imagen de perfil
router.post('/upload-avatar', upload.single('avatar'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ status: 'error', message: 'No se subió ningún archivo de imagen' });
    }
    const avatar_url = `/uploads/avatars/${req.file.filename}`;
    res.json({
      status: 'success',
      message: 'Imagen subida exitosamente',
      avatar_url
    });
  } catch (error) {
    console.error('Error al subir avatar:', error);
    res.status(500).json({ status: 'error', message: 'Error al procesar la imagen' });
  }
});

// 2. POST /api/auth/login - Autenticación de Usuarios
router.post('/login', async (req, res) => {
  try {
    const { nombre_usuario, password } = req.body;

    if (!nombre_usuario || !password) {
      return res.status(400).json({ status: 'error', message: 'Nombre de usuario y contraseña son requeridos' });
    }

    const result = await pool.query('SELECT * FROM usuarios WHERE nombre_usuario = $1 AND activo = true', [nombre_usuario]);

    if (result.rows.length === 0) {
      return res.status(401).json({ status: 'error', message: 'Credenciales inválidas o usuario inactivo' });
    }

    const usuario = result.rows[0];
    const passwordMatch = await bcrypt.compare(password, usuario.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ status: 'error', message: 'Credenciales inválidas' });
    }

    const token = jwt.sign(
      { id: usuario.id, nombre_usuario: usuario.nombre_usuario, rol: usuario.rol },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({
      status: 'success',
      message: 'Inicio de sesión exitoso',
      token,
      usuario: {
        id: usuario.id,
        nombre_usuario: usuario.nombre_usuario,
        email: usuario.email,
        rol: usuario.rol,
        foto_url: usuario.foto_url
      }
    });
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ status: 'error', message: 'Error en el servidor al iniciar sesión' });
  }
});

// 3. GET /api/auth/usuarios - Listar todos los usuarios
router.get('/usuarios', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, nombre_usuario, email, rol, foto_url, activo, created_at FROM usuarios ORDER BY id ASC');
    res.json({ status: 'success', data: result.rows });
  } catch (error) {
    console.error('Error al listar usuarios:', error);
    res.status(500).json({ status: 'error', message: 'Error al consultar usuarios' });
  }
});

// 4. POST /api/auth/crear-usuario - Crear nuevo usuario (ADMIN y SUPER_USER)
router.post('/crear-usuario', async (req, res) => {
  const client = await pool.connect();
  try {
    const { nombre_usuario, email, password, rol, foto_url, admin_usuario_id } = req.body;

    if (!nombre_usuario || !email || !password || !rol) {
      return res.status(400).json({ status: 'error', message: 'Todos los campos marcados con (*) son obligatorios' });
    }

    const solicitanteRes = await client.query('SELECT * FROM usuarios WHERE id = $1', [admin_usuario_id]);
    if (solicitanteRes.rows.length === 0) {
      return res.status(401).json({ status: 'error', message: 'Usuario solicitante no válido' });
    }
    const solicitante = solicitanteRes.rows[0];

    // Regla de Rango: SUPER_USER solo puede crear cuentas de nivel 'USER'
    if (solicitante.rol === 'SUPER_USER' && rol !== 'USER') {
      return res.status(403).json({ status: 'error', message: 'Un Super-Usuario sólo puede crear cuentas de nivel Usuario.' });
    }

    await client.query('BEGIN');

    const password_hash = await bcrypt.hash(password, 10);

    const queryText = `
      INSERT INTO usuarios (nombre_usuario, email, password_hash, rol, foto_url)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, nombre_usuario, email, rol, foto_url, created_at
    `;
    const result = await client.query(queryText, [nombre_usuario, email, password_hash, rol, foto_url || null]);
    const nuevoUsuario = result.rows[0];

    await client.query(
      'INSERT INTO historial_auditoria (usuario_id, accion, detalles) VALUES ($1, $2, $3)',
      [admin_usuario_id, 'CREAR_USUARIO', `Creación de usuario ${nombre_usuario} con rol ${rol}`]
    );

    await client.query('COMMIT');

    res.status(201).json({
      status: 'success',
      message: 'Usuario creado exitosamente',
      data: nuevoUsuario
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al crear usuario:', error);
    if (error.code === '23505') {
      return res.status(400).json({ status: 'error', message: 'El nombre de usuario o email ya están registrados' });
    }
    res.status(500).json({ status: 'error', message: 'Error al registrar el usuario' });
  } finally {
    client.release();
  }
});

// 5. PUT /api/auth/usuarios/:id - Editar datos de un usuario (Con control estricto de Rango)
router.put('/usuarios/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre_usuario, email, rol, password, foto_url, usuario_solicitante_id } = req.body;

    const solicitanteRes = await pool.query('SELECT * FROM usuarios WHERE id = $1', [usuario_solicitante_id]);
    if (solicitanteRes.rows.length === 0) {
      return res.status(401).json({ status: 'error', message: 'Usuario solicitante no válido' });
    }
    const solicitante = solicitanteRes.rows[0];

    const targetRes = await pool.query('SELECT * FROM usuarios WHERE id = $1', [id]);
    if (targetRes.rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Usuario a editar no encontrado' });
    }
    const targetUser = targetRes.rows[0];

    // Regla de Rango: SUPER_USER sólo puede editar usuarios de rol 'USER'
    if (solicitante.rol === 'SUPER_USER' && targetUser.rol !== 'USER') {
      return res.status(403).json({ status: 'error', message: 'Los Super-Usuarios sólo pueden modificar cuentas de rango Usuario.' });
    }

    let nuevoHash = targetUser.password_hash;
    if (password && password.trim() !== '') {
      nuevoHash = await bcrypt.hash(password, 10);
    }

    const nuevoNombre = (solicitante.rol === 'ADMIN') ? (nombre_usuario || targetUser.nombre_usuario) : targetUser.nombre_usuario;
    const nuevoEmail = (solicitante.rol === 'ADMIN') ? (email || targetUser.email) : targetUser.email;
    const nuevoRol = (solicitante.rol === 'ADMIN') ? (rol || targetUser.rol) : targetUser.rol;
    const nuevaFoto = (foto_url !== undefined) ? foto_url : targetUser.foto_url;

    const queryText = `
      UPDATE usuarios
      SET nombre_usuario = $1, email = $2, rol = $3, password_hash = $4, foto_url = $5
      WHERE id = $6
      RETURNING id, nombre_usuario, email, rol, foto_url
    `;
    const result = await pool.query(queryText, [nuevoNombre, nuevoEmail, nuevoRol, nuevoHash, nuevaFoto, id]);

    await pool.query(
      'INSERT INTO historial_auditoria (usuario_id, accion, detalles) VALUES ($1, $2, $3)',
      [solicitante.id, 'EDITAR_USUARIO', `Edición de usuario ${targetUser.nombre_usuario} (ID #${id}) realizada por ${solicitante.nombre_usuario}`]
    );

    res.json({ status: 'success', message: 'Usuario actualizado exitosamente', data: result.rows[0] });
  } catch (error) {
    console.error('Error al editar usuario:', error);
    res.status(500).json({ status: 'error', message: 'Error en el servidor al editar usuario' });
  }
});

// 6. DELETE /api/auth/usuarios/:id - Eliminar un usuario (Con control de Rango)
router.delete('/usuarios/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { usuario_solicitante_id } = req.query;

    const solicitanteRes = await pool.query('SELECT * FROM usuarios WHERE id = $1', [usuario_solicitante_id]);
    if (solicitanteRes.rows.length === 0) {
      return res.status(401).json({ status: 'error', message: 'Usuario solicitante no válido' });
    }
    const solicitante = solicitanteRes.rows[0];

    const targetRes = await pool.query('SELECT * FROM usuarios WHERE id = $1', [id]);
    if (targetRes.rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Usuario no encontrado' });
    }
    const targetUser = targetRes.rows[0];

    // No se puede eliminar a un Administrador
    if (targetUser.rol === 'ADMIN') {
      return res.status(403).json({ status: 'error', message: 'No se permite eliminar cuentas de rango Administrador.' });
    }

    // SUPER_USER solo puede eliminar a cuentas 'USER'
    if (solicitante.rol === 'SUPER_USER' && targetUser.rol !== 'USER') {
      return res.status(403).json({ status: 'error', message: 'Un Super-Usuario sólo puede eliminar cuentas de rango Usuario.' });
    }

    await pool.query('DELETE FROM usuarios WHERE id = $1', [id]);

    await pool.query(
      'INSERT INTO historial_auditoria (usuario_id, accion, detalles) VALUES ($1, $2, $3)',
      [solicitante.id, 'ELIMINAR_USUARIO', `Usuario ${targetUser.nombre_usuario} (ID #${id}) fue ELIMINADO por ${solicitante.nombre_usuario}`]
    );

    res.json({ status: 'success', message: 'Usuario eliminado exitosamente' });
  } catch (error) {
    console.error('Error al eliminar usuario:', error);
    res.status(500).json({ status: 'error', message: 'Error en el servidor al eliminar usuario' });
  }
});

// 7. PUT /api/auth/perfil/:id - Actualización de mi propio perfil
router.put('/perfil/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { password_actual, nueva_password, foto_url } = req.body;

    const userRes = await pool.query('SELECT * FROM usuarios WHERE id = $1', [id]);
    if (userRes.rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Usuario no encontrado' });
    }

    const usuario = userRes.rows[0];
    let nuevoHash = usuario.password_hash;

    if (nueva_password) {
      if (!password_actual) {
        return res.status(400).json({ status: 'error', message: 'Debe ingresar la contraseña actual para cambiarla' });
      }
      const match = await bcrypt.compare(password_actual, usuario.password_hash);
      if (!match) {
        return res.status(400).json({ status: 'error', message: 'La contraseña actual no es correcta' });
      }
      nuevoHash = await bcrypt.hash(nueva_password, 10);
    }

    const nuevaFoto = (foto_url !== undefined) ? foto_url : usuario.foto_url;

    const updateQuery = `
      UPDATE usuarios
      SET password_hash = $1, foto_url = $2
      WHERE id = $3
      RETURNING id, nombre_usuario, email, rol, foto_url
    `;

    const result = await pool.query(updateQuery, [nuevoHash, nuevaFoto, id]);

    res.json({
      status: 'success',
      message: 'Perfil actualizado exitosamente',
      usuario: result.rows[0]
    });
  } catch (error) {
    console.error('Error al actualizar perfil:', error);
    res.status(500).json({ status: 'error', message: 'Error al actualizar perfil de usuario' });
  }
});

module.exports = router;
