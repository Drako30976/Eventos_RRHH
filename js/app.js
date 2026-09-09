/* =========================================================
   LÓGICA DEL FRONTEND - GESTOR DE EVENTOS DE RRHH
   ========================================================= */

// Usar ruta relativa '/api' para que funcione dinámicamente tanto en localhost como en Render.com
const API_BASE_URL = '/api';

// Estado global de la aplicación
const state = {
  usuarioActual: null,
  token: null,
  empresas: [],
  empleados: [],
  estadosCiviles: [],
  tiposEvento: [],
  eventos: [],
  auditoria: [],
  usuariosAdmin: []
};

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
  initAuth();
  initTabs();
  initModals();
  initCharCounters();
  initForms();
  initFileUpload();
});

/* ---------------------------------------------------------
   1. AUTENTICACIÓN Y PERMISOS DE RANGO
   --------------------------------------------------------- */
function initAuth() {
  const token = localStorage.getItem('rrhh_token');
  const user = localStorage.getItem('rrhh_user');

  if (token && user) {
    state.token = token;
    state.usuarioActual = JSON.parse(user);
    mostrarApp();
  } else {
    mostrarLogin();
  }

  document.getElementById('form-login').addEventListener('submit', realizarLogin);
  document.getElementById('btn-logout').addEventListener('click', cerrarSesion);
}

async function realizarLogin(e) {
  e.preventDefault();
  const nombre_usuario = document.getElementById('login-user').value.trim();
  const password = document.getElementById('login-pass').value.trim();
  const errorDiv = document.getElementById('login-error');

  errorDiv.textContent = '';

  try {
    const res = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre_usuario, password })
    });
    const data = await res.json();

    if (res.ok) {
      state.token = data.token;
      state.usuarioActual = data.usuario;
      localStorage.setItem('rrhh_token', data.token);
      localStorage.setItem('rrhh_user', JSON.stringify(data.usuario));
      mostrarApp();
    } else {
      errorDiv.textContent = data.message || 'Error al iniciar sesión';
    }
  } catch (err) {
    errorDiv.textContent = 'No se pudo conectar con el servidor backend.';
  }
}

function cerrarSesion() {
  localStorage.removeItem('rrhh_token');
  localStorage.removeItem('rrhh_user');
  state.token = null;
  state.usuarioActual = null;
  mostrarLogin();
}

function mostrarLogin() {
  document.getElementById('login-overlay').classList.add('active');
  document.getElementById('app-wrapper').style.display = 'none';
}

function resolverAvatarUrl(fotoUrl, nombreUsuario) {
  if (!fotoUrl || fotoUrl.trim() === '') {
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(nombreUsuario)}&background=2b5797&color=fff`;
  }
  return fotoUrl;
}

function mostrarApp() {
  document.getElementById('login-overlay').classList.remove('active');
  document.getElementById('app-wrapper').style.display = 'block';

  document.getElementById('lbl-usuario').textContent = state.usuarioActual.nombre_usuario;

  const avatarUrl = resolverAvatarUrl(state.usuarioActual.foto_url, state.usuarioActual.nombre_usuario);

  const headerAvatar = document.getElementById('header-avatar');
  const perfilAvatar = document.getElementById('perfil-avatar-img');

  if (headerAvatar) headerAvatar.src = avatarUrl;
  if (perfilAvatar) perfilAvatar.src = avatarUrl;
  document.getElementById('perfil-foto-url').value = state.usuarioActual.foto_url || '';

  aplicarPermisosRol();
  cargarTodo();
}

function aplicarPermisosRol() {
  const rol = state.usuarioActual.rol;
  const esLectura = (rol === 'USER');

  document.getElementById('btn-nuevo-evento').style.display = esLectura ? 'none' : 'inline-flex';
  document.getElementById('btn-nuevo-empleado').style.display = esLectura ? 'none' : 'inline-flex';
  document.getElementById('btn-nueva-empresa').style.display = esLectura ? 'none' : 'inline-flex';
  document.getElementById('btn-nuevo-tipo-evento').style.display = esLectura ? 'none' : 'inline-flex';

  const adminSection = document.getElementById('admin-user-section');
  if (rol === 'ADMIN' || rol === 'SUPER_USER') {
    adminSection.style.display = 'block';
    cargarUsuariosAdmin();
  } else {
    adminSection.style.display = 'none';
  }
}

/* ---------------------------------------------------------
   2. SUBIDA DE ARCHIVOS (AVATAR DE USUARIO Y LOGO DE EMPRESA)
   --------------------------------------------------------- */
function initFileUpload() {
  // 1. Subida de foto de perfil del usuario logueado
  const fileInputPerfil = document.getElementById('perfil-foto-file');
  fileInputPerfil.addEventListener('change', async () => {
    if (!fileInputPerfil.files || fileInputPerfil.files.length === 0) return;
    const formData = new FormData();
    formData.append('avatar', fileInputPerfil.files[0]);

    try {
      const res = await fetch(`${API_BASE_URL}/auth/upload-avatar`, { method: 'POST', body: formData });
      const data = await res.json();
      if (res.ok) {
        document.getElementById('perfil-foto-url').value = data.avatar_url;
        document.getElementById('perfil-avatar-img').src = data.avatar_url;
        document.getElementById('header-avatar').src = data.avatar_url;
        alert('Foto de perfil cargada exitosamente desde su PC!');
      } else alert(`Error: ${data.message}`);
    } catch (err) { alert('Error al subir imagen de perfil'); }
  });

  // 2. Subida de foto de perfil desde el Modal de Crear/Editar Usuario (Admin/SuperUser)
  const fileInputUsrModal = document.getElementById('usr-foto-file');
  fileInputUsrModal.addEventListener('change', async () => {
    if (!fileInputUsrModal.files || fileInputUsrModal.files.length === 0) return;
    const formData = new FormData();
    formData.append('avatar', fileInputUsrModal.files[0]);

    try {
      const res = await fetch(`${API_BASE_URL}/auth/upload-avatar`, { method: 'POST', body: formData });
      const data = await res.json();
      if (res.ok) {
        document.getElementById('usr-foto').value = data.avatar_url;
        alert('Foto del nuevo usuario cargada exitosamente!');
      } else alert(`Error: ${data.message}`);
    } catch (err) { alert('Error al subir foto de usuario'); }
  });

  // 3. Subida de logo de empresa desde PC
  const fileInputLogo = document.getElementById('empresa-logo-file');
  fileInputLogo.addEventListener('change', async () => {
    if (!fileInputLogo.files || fileInputLogo.files.length === 0) return;
    const formData = new FormData();
    formData.append('logo', fileInputLogo.files[0]);

    try {
      const res = await fetch(`${API_BASE_URL}/empresas/upload-logo`, { method: 'POST', body: formData });
      const data = await res.json();
      if (res.ok) {
        document.getElementById('empresa-logo').value = data.logo_url;
        alert('Logo de la empresa cargado exitosamente desde su PC!');
      } else alert(`Error: ${data.message}`);
    } catch (err) { alert('Error al subir logo'); }
  });
}

/* ---------------------------------------------------------
   3. NAVEGACIÓN Y MODALES
   --------------------------------------------------------- */
function initTabs() {
  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');

  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTab = btn.getAttribute('data-tab');
      tabButtons.forEach(b => b.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(targetTab).classList.add('active');
    });
  });
}

function initModals() {
  document.getElementById('btn-nuevo-evento').addEventListener('click', () => abrirModalEvento());
  document.getElementById('btn-nuevo-empleado').addEventListener('click', () => abrirModal('modal-empleado'));
  document.getElementById('btn-nueva-empresa').addEventListener('click', () => abrirModalEmpresa());
  document.getElementById('btn-nuevo-tipo-evento').addEventListener('click', () => abrirModalTipoEvento());
  document.getElementById('btn-nuevo-usuario-modal').addEventListener('click', () => abrirModalUsuario());

  document.querySelectorAll('[data-close]').forEach(btn => {
    btn.addEventListener('click', () => cerrarModal(btn.getAttribute('data-close')));
  });
}

function abrirModal(modalId) { document.getElementById(modalId).classList.add('active'); }
function cerrarModal(modalId) { document.getElementById(modalId).classList.remove('active'); }

function initCharCounters() {
  const descInput = document.getElementById('evt-descripcion');
  const descCount = document.getElementById('evt-desc-count');
  descInput.addEventListener('input', () => descCount.textContent = descInput.value.length);

  const resInput = document.getElementById('evt-resolucion');
  const resCount = document.getElementById('evt-res-count');
  resInput.addEventListener('input', () => resCount.textContent = resInput.value.length);
}

/* ---------------------------------------------------------
   4. CARGA DE DATOS API
   --------------------------------------------------------- */
async function cargarTodo() {
  try {
    await Promise.all([
      cargarEmpresas(),
      cargarEmpleados(),
      cargarCatalogos(),
      cargarEventos(),
      cargarAuditoria()
    ]);
    poblarSelectores();
  } catch (error) { console.error('Error al cargar datos:', error); }
}

async function cargarEmpresas() {
  const res = await fetch(`${API_BASE_URL}/empresas`);
  const data = await res.json();
  state.empresas = data.data || [];
  renderEmpresas();
}

async function cargarEmpleados() {
  const res = await fetch(`${API_BASE_URL}/empleados`);
  const data = await res.json();
  state.empleados = data.data || [];
  renderEmpleados();
}

async function cargarCatalogos() {
  const resEC = await fetch(`${API_BASE_URL}/catalogos/estados-civiles`);
  const dataEC = await resEC.json();
  state.estadosCiviles = dataEC.data || [];

  const resTE = await fetch(`${API_BASE_URL}/catalogos/tipos-evento`);
  const dataTE = await resTE.json();
  state.tiposEvento = dataTE.data || [];
  renderTiposEvento();
}

async function cargarEventos() {
  const res = await fetch(`${API_BASE_URL}/eventos`);
  const data = await res.json();
  state.eventos = data.data || [];
  renderEventos(state.eventos, 'tbody-eventos');
  renderEventos(state.eventos, 'tbody-reportes');
}

async function cargarAuditoria() {
  const res = await fetch(`${API_BASE_URL}/eventos/auditoria`);
  const data = await res.json();
  state.auditoria = data.data || [];
  renderAuditoria();
}

async function cargarUsuariosAdmin() {
  const res = await fetch(`${API_BASE_URL}/auth/usuarios`);
  const data = await res.json();
  state.usuariosAdmin = data.data || [];
  renderUsuariosAdmin();
}

/* ---------------------------------------------------------
   5. POBLAR SELECTORES
   --------------------------------------------------------- */
function poblarSelectores() {
  const selectEmpresaEmp = document.getElementById('emp-empresa');
  const selectEmpresaRep = document.getElementById('rep-empresa');
  selectEmpresaEmp.innerHTML = '<option value="">Seleccione una empresa...</option>';
  selectEmpresaRep.innerHTML = '<option value="">Todas las Empresas</option>';
  state.empresas.forEach(emp => {
    selectEmpresaEmp.innerHTML += `<option value="${emp.id}">${emp.nombre}</option>`;
    selectEmpresaRep.innerHTML += `<option value="${emp.id}">${emp.nombre}</option>`;
  });

  const selectEmpleadoEvt = document.getElementById('evt-empleado');
  const selectEmpleadoRep = document.getElementById('rep-empleado');
  selectEmpleadoEvt.innerHTML = '<option value="">Seleccione un empleado...</option>';
  selectEmpleadoRep.innerHTML = '<option value="">Todos los Empleados</option>';
  state.empleados.forEach(emp => {
    selectEmpleadoEvt.innerHTML += `<option value="${emp.id}">${emp.nombre_completo} (${emp.documento})</option>`;
    selectEmpleadoRep.innerHTML += `<option value="${emp.id}">${emp.nombre_completo}</option>`;
  });

  const selectEstadoCivil = document.getElementById('emp-estado-civil');
  selectEstadoCivil.innerHTML = '<option value="">Seleccione estado civil...</option>';
  state.estadosCiviles.forEach(ec => {
    selectEstadoCivil.innerHTML += `<option value="${ec.id}">${ec.nombre}</option>`;
  });

  const selectTipoEvt = document.getElementById('evt-tipo');
  const selectTipoRep = document.getElementById('rep-tipo-evento');
  selectTipoEvt.innerHTML = '<option value="">Seleccione tipo de evento...</option>';
  selectTipoRep.innerHTML = '<option value="">Todos los Tipos</option>';
  state.tiposEvento.forEach(te => {
    selectTipoEvt.innerHTML += `<option value="${te.id}">${te.etiqueta}</option>`;
    selectTipoRep.innerHTML += `<option value="${te.id}">${te.etiqueta}</option>`;
  });
}

/* ---------------------------------------------------------
   6. RENDERIZADO DE TABLAS
   --------------------------------------------------------- */
function renderEmpresas() {
  const tbody = document.getElementById('tbody-empresas');
  tbody.innerHTML = '';
  const esModificable = (state.usuarioActual.rol === 'ADMIN' || state.usuarioActual.rol === 'SUPER_USER');

  state.empresas.forEach(emp => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${emp.id}</td>
      <td><strong>${emp.nombre}</strong></td>
      <td>${emp.cuit}</td>
      <td>${emp.logo_url ? `<img src="${emp.logo_url}" class="logo-thumb" alt="Logo de ${emp.nombre}">` : '<span class="badge badge-secondary">Sin Logo</span>'}</td>
      <td>${new Date(emp.created_at).toLocaleDateString()}</td>
      <td>
        ${esModificable ? `
          <button class="btn btn-primary btn-sm" onclick="editarEmpresa(${emp.id})">✏️ Editar</button>
          <button class="btn btn-danger btn-sm" onclick="eliminarEmpresa(${emp.id})">🗑️ Borrar</button>
        ` : '<span class="badge badge-info">Solo Lectura</span>'}
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function renderEmpleados() {
  const tbody = document.getElementById('tbody-empleados');
  tbody.innerHTML = '';
  state.empleados.forEach(emp => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${emp.id}</td>
      <td><strong>${emp.nombre_completo}</strong></td>
      <td>${emp.documento}</td>
      <td>${emp.numero_legajo || '-'}</td>
      <td><span class="badge badge-info">${emp.empresa_nombre}</span></td>
      <td>${emp.estado_civil_nombre}</td>
      <td>${new Date(emp.fecha_nacimiento).toLocaleDateString()}</td>
      <td>${emp.fecha_ingreso ? new Date(emp.fecha_ingreso).toLocaleDateString() : '-'}</td>
    `;
    tbody.appendChild(tr);
  });
}

function renderTiposEvento() {
  const tbody = document.getElementById('tbody-tipos-evento');
  tbody.innerHTML = '';
  const esModificable = (state.usuarioActual.rol === 'ADMIN' || state.usuarioActual.rol === 'SUPER_USER');

  state.tiposEvento.forEach(te => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${te.id}</td>
      <td><strong><span class="badge badge-warning">${te.etiqueta}</span></strong></td>
      <td>${te.descripcion || 'Sin descripción'}</td>
      <td>
        ${esModificable ? `
          <button class="btn btn-primary btn-sm" onclick="editarTipoEvento(${te.id})">✏️ Editar</button>
          <button class="btn btn-danger btn-sm" onclick="eliminarTipoEvento(${te.id})">🗑️ Borrar</button>
        ` : '<span class="badge badge-info">Solo Lectura</span>'}
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function renderEventos(listaEventos, elementId) {
  const tbody = document.getElementById(elementId);
  tbody.innerHTML = '';
  if (listaEventos.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;">No se encontraron registros.</td></tr>';
    return;
  }

  const esModificable = (state.usuarioActual.rol === 'ADMIN' || state.usuarioActual.rol === 'SUPER_USER');

  listaEventos.forEach(evt => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${evt.id}</td>
      <td>${new Date(evt.fecha_registro).toLocaleString()}</td>
      <td><strong>${evt.empleado_nombre}</strong></td>
      <td>${evt.empresa_nombre}</td>
      <td><span class="badge badge-warning">${evt.tipo_evento_etiqueta}</span></td>
      <td>${evt.descripcion}</td>
      <td>${evt.resolucion ? `<span class="badge badge-success">${evt.resolucion}</span>` : '<em>Pendiente</em>'}</td>
      <td>${evt.creado_por_usuario}</td>
      ${elementId === 'tbody-eventos' ? `
        <td>
          ${esModificable ? `
            <button class="btn btn-primary btn-sm" onclick="editarEvento(${evt.id})">✏️</button>
            <button class="btn btn-danger btn-sm" onclick="eliminarEvento(${evt.id})">🗑️</button>
          ` : '<span class="badge badge-info">Solo Lectura</span>'}
        </td>
      ` : ''}
    `;
    tbody.appendChild(tr);
  });
}

function renderAuditoria() {
  const tbody = document.getElementById('tbody-auditoria');
  tbody.innerHTML = '';
  state.auditoria.forEach(aud => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${aud.id}</td>
      <td>${new Date(aud.fecha_hora).toLocaleString()}</td>
      <td><strong>${aud.nombre_usuario}</strong></td>
      <td><span class="badge badge-info">${aud.rol}</span></td>
      <td><span class="badge badge-warning">${aud.accion}</span></td>
      <td>${aud.detalles}</td>
    `;
    tbody.appendChild(tr);
  });
}

function renderUsuariosAdmin() {
  const tbody = document.getElementById('tbody-usuarios-admin');
  tbody.innerHTML = '';
  const rol = state.usuarioActual.rol;

  state.usuariosAdmin.forEach(u => {
    const tr = document.createElement('tr');
    let puedeEditar = false;
    let puedeBorrar = false;

    if (rol === 'ADMIN') {
      puedeEditar = true;
      puedeBorrar = (u.rol !== 'ADMIN' && u.id !== state.usuarioActual.id);
    } else if (rol === 'SUPER_USER') {
      puedeEditar = (u.rol === 'USER');
      puedeBorrar = (u.rol === 'USER');
    }

    tr.innerHTML = `
      <td>${u.id}</td>
      <td><strong>${u.nombre_usuario}</strong></td>
      <td>${u.email}</td>
      <td><span class="badge badge-info">${u.rol}</span></td>
      <td><span class="badge badge-success">${u.activo ? 'Activo' : 'Inactivo'}</span></td>
      <td>${new Date(u.created_at).toLocaleDateString()}</td>
      <td>
        ${puedeEditar ? `<button class="btn btn-primary btn-sm" onclick="editarUsuarioAdmin(${u.id})">✏️ Editar</button>` : ''}
        ${puedeBorrar ? `<button class="btn btn-danger btn-sm" onclick="eliminarUsuarioAdmin(${u.id})">🗑️ Borrar</button>` : ''}
        ${(!puedeEditar && !puedeBorrar) ? '<span class="badge badge-info">Sin Permiso</span>' : ''}
      </td>
    `;
    tbody.appendChild(tr);
  });
}

/* ---------------------------------------------------------
   7. MODALES Y ACCIONES (EMPRESAS, EVENTOS, TIPOS DE EVENTO, USUARIOS)
   --------------------------------------------------------- */
function abrirModalEmpresa(empObj = null) {
  const modalTitle = document.getElementById('modal-empresa-title');
  const editIdInput = document.getElementById('empresa-edit-id');

  if (empObj) {
    modalTitle.textContent = '✏️ Editar Empresa';
    editIdInput.value = empObj.id;
    document.getElementById('empresa-nombre').value = empObj.nombre;
    document.getElementById('empresa-cuit').value = empObj.cuit;
    document.getElementById('empresa-logo').value = empObj.logo_url || '';
  } else {
    modalTitle.textContent = '➕ Registrar Nueva Empresa';
    editIdInput.value = '';
    document.getElementById('form-empresa').reset();
    document.getElementById('empresa-logo').value = '';
  }
  document.getElementById('empresa-logo-file').value = '';
  abrirModal('modal-empresa');
}

window.editarEmpresa = function(id) {
  const emp = state.empresas.find(e => e.id === id);
  if (emp) abrirModalEmpresa(emp);
};

window.eliminarEmpresa = async function(id) {
  if (!confirm(`¿Está seguro de eliminar la empresa ID #${id}?`)) return;
  try {
    const res = await fetch(`${API_BASE_URL}/empresas/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (res.ok) {
      alert('Empresa eliminada exitosamente.');
      cargarTodo();
    } else alert(`Error: ${data.message}`);
  } catch (err) { alert('Error de conexión'); }
};

function abrirModalUsuario(usrObj = null) {
  const modalTitle = document.getElementById('modal-usuario-title');
  const editIdInput = document.getElementById('usr-edit-id');
  const groupRol = document.getElementById('group-usr-rol');

  if (usrObj) {
    modalTitle.textContent = '✏️ Editar Usuario';
    editIdInput.value = usrObj.id;
    document.getElementById('usr-nombre').value = usrObj.nombre_usuario;
    document.getElementById('usr-email').value = usrObj.email;
    document.getElementById('usr-pass').value = '';
    document.getElementById('usr-rol').value = usrObj.rol;
    document.getElementById('usr-foto').value = usrObj.foto_url || '';
    groupRol.style.display = (state.usuarioActual.rol === 'ADMIN') ? 'block' : 'none';
  } else {
    modalTitle.textContent = '➕ Crear Nuevo Usuario del Sistema';
    editIdInput.value = '';
    document.getElementById('form-crear-usuario').reset();
    document.getElementById('usr-foto').value = '';
    groupRol.style.display = 'block';
  }
  document.getElementById('usr-foto-file').value = '';
  abrirModal('modal-usuario');
}

window.editarUsuarioAdmin = function(id) {
  const usr = state.usuariosAdmin.find(u => u.id === id);
  if (usr) abrirModalUsuario(usr);
};

window.eliminarUsuarioAdmin = async function(id) {
  if (!confirm(`¿Está seguro de eliminar el usuario ID #${id}?`)) return;
  try {
    const res = await fetch(`${API_BASE_URL}/auth/usuarios/${id}?usuario_solicitante_id=${state.usuarioActual.id}`, { method: 'DELETE' });
    const data = await res.json();
    if (res.ok) {
      alert('Usuario eliminado correctamente.');
      cargarUsuariosAdmin();
      cargarAuditoria();
    } else alert(`Error: ${data.message}`);
  } catch (err) { alert('Error de conexión'); }
};

function abrirModalTipoEvento(teObj = null) {
  const modalTitle = document.getElementById('modal-tipo-evento-title');
  const editIdInput = document.getElementById('te-edit-id');

  if (teObj) {
    modalTitle.textContent = '✏️ Editar Tipo de Evento';
    editIdInput.value = teObj.id;
    document.getElementById('te-etiqueta').value = teObj.etiqueta;
    document.getElementById('te-descripcion').value = teObj.descripcion || '';
  } else {
    modalTitle.textContent = '➕ Nuevo Tipo de Evento';
    editIdInput.value = '';
    document.getElementById('form-tipo-evento').reset();
  }
  abrirModal('modal-tipo-evento');
}

window.editarTipoEvento = function(id) {
  const te = state.tiposEvento.find(t => t.id === id);
  if (te) abrirModalTipoEvento(te);
};

window.eliminarTipoEvento = async function(id) {
  if (!confirm(`¿Está seguro de borrar este tipo de evento?`)) return;
  try {
    const res = await fetch(`${API_BASE_URL}/catalogos/tipos-evento/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (res.ok) {
      alert('Tipo de evento eliminado.');
      cargarCatalogos();
    } else alert(`Error: ${data.message}`);
  } catch (err) { alert('Error de conexión'); }
};

function abrirModalEvento(eventoObj = null) {
  const modalTitle = document.getElementById('modal-evento-title');
  const editIdInput = document.getElementById('evt-edit-id');

  if (eventoObj) {
    modalTitle.textContent = '✏️ Editar Evento de RRHH';
    editIdInput.value = eventoObj.id;
    document.getElementById('evt-empleado').value = eventoObj.empleado_id;
    document.getElementById('evt-tipo').value = eventoObj.tipo_evento_id;
    document.getElementById('evt-descripcion').value = eventoObj.descripcion;
    document.getElementById('evt-resolucion').value = eventoObj.resolucion || '';
  } else {
    modalTitle.textContent = '➕ Registrar Nuevo Evento de RRHH';
    editIdInput.value = '';
    document.getElementById('form-evento').reset();
  }
  abrirModal('modal-evento');
}

window.editarEvento = function(id) {
  const evt = state.eventos.find(e => e.id === id);
  if (evt) abrirModalEvento(evt);
};

window.eliminarEvento = async function(id) {
  if (!confirm(`¿Está seguro de eliminar el evento ID #${id}? Esta acción quedará asentada en Auditoría.`)) return;
  try {
    const res = await fetch(`${API_BASE_URL}/eventos/${id}?usuario_id=${state.usuarioActual.id}`, { method: 'DELETE' });
    const data = await res.json();
    if (res.ok) {
      alert('Evento eliminado correctamente.');
      cargarTodo();
    } else alert(`Error: ${data.message}`);
  } catch (err) { alert('Error de conexión'); }
};

/* ---------------------------------------------------------
   8. GUARDADO DE FORMULARIOS
   --------------------------------------------------------- */
function initForms() {
  document.getElementById('btn-guardar-empresa').addEventListener('click', guardarEmpresa);
  document.getElementById('btn-guardar-empleado').addEventListener('click', guardarEmpleado);
  document.getElementById('btn-guardar-evento').addEventListener('click', guardarEvento);
  document.getElementById('btn-guardar-tipo-evento').addEventListener('click', guardarTipoEvento);
  document.getElementById('btn-guardar-usuario-modal').addEventListener('click', guardarUsuarioAdminModal);
  document.getElementById('btn-filtrar-reporte').addEventListener('click', generarReporteCruzado);
  document.getElementById('form-perfil').addEventListener('submit', guardarPerfil);
}

async function guardarEmpresa(e) {
  e.preventDefault();
  const editId = document.getElementById('empresa-edit-id').value;
  const nombre = document.getElementById('empresa-nombre').value.trim();
  const cuit = document.getElementById('empresa-cuit').value.trim();
  const logo_url = document.getElementById('empresa-logo').value.trim();

  if (!nombre || !cuit) return alert('Nombre y CUIT obligatorios');

  const isEdit = Boolean(editId);
  const url = isEdit ? `${API_BASE_URL}/empresas/${editId}` : `${API_BASE_URL}/empresas`;
  const method = isEdit ? 'PUT' : 'POST';

  try {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre, cuit, logo_url })
    });
    const data = await res.json();
    if (res.ok) {
      alert(isEdit ? 'Empresa actualizada exitosamente!' : 'Empresa registrada exitosamente!');
      cerrarModal('modal-empresa');
      document.getElementById('form-empresa').reset();
      document.getElementById('empresa-logo-file').value = '';
      document.getElementById('empresa-logo').value = '';
      cargarTodo();
    } else alert(`Error: ${data.message}`);
  } catch (err) { alert('Error de conexión'); }
}

async function guardarTipoEvento(e) {
  e.preventDefault();
  const editId = document.getElementById('te-edit-id').value;
  const etiqueta = document.getElementById('te-etiqueta').value.trim();
  const descripcion = document.getElementById('te-descripcion').value.trim();

  if (!etiqueta) return alert('La etiqueta es obligatoria');

  const isEdit = Boolean(editId);
  const url = isEdit ? `${API_BASE_URL}/catalogos/tipos-evento/${editId}` : `${API_BASE_URL}/catalogos/tipos-evento`;
  const method = isEdit ? 'PUT' : 'POST';

  try {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ etiqueta, descripcion })
    });
    const data = await res.json();
    if (res.ok) {
      alert(isEdit ? 'Tipo de evento actualizado!' : 'Tipo de evento creado!');
      cerrarModal('modal-tipo-evento');
      document.getElementById('form-tipo-evento').reset();
      cargarCatalogos();
    } else alert(`Error: ${data.message}`);
  } catch (err) { alert('Error de conexión'); }
}

async function guardarEmpleado(e) {
  e.preventDefault();
  const nombre_completo = document.getElementById('emp-nombre').value.trim();
  const documento = document.getElementById('emp-documento').value.trim();
  const numero_legajo = document.getElementById('emp-legajo').value.trim();
  const empresa_id = document.getElementById('emp-empresa').value;
  const estado_civil_id = document.getElementById('emp-estado-civil').value;
  const fecha_nacimiento = document.getElementById('emp-nacimiento').value;
  const fecha_ingreso = document.getElementById('emp-ingreso').value;

  if (!nombre_completo || !documento || !empresa_id || !estado_civil_id || !fecha_nacimiento) {
    return alert('Complete todos los campos obligatorios (*)');
  }

  try {
    const res = await fetch(`${API_BASE_URL}/empleados`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre_completo, documento, numero_legajo, empresa_id, estado_civil_id, fecha_nacimiento, fecha_ingreso })
    });
    const data = await res.json();
    if (res.ok) {
      alert('Empleado guardado!');
      cerrarModal('modal-empleado');
      document.getElementById('form-empleado').reset();
      cargarTodo();
    } else alert(`Error: ${data.message}`);
  } catch (err) { alert('Error de conexión'); }
}

async function guardarEvento(e) {
  e.preventDefault();
  const editId = document.getElementById('evt-edit-id').value;
  const empleado_id = document.getElementById('evt-empleado').value;
  const tipo_evento_id = document.getElementById('evt-tipo').value;
  const descripcion = document.getElementById('evt-descripcion').value.trim();
  const resolucion = document.getElementById('evt-resolucion').value.trim();

  if (!empleado_id || !tipo_evento_id || !descripcion) return alert('Complete los campos obligatorios (*)');

  const isEdit = Boolean(editId);
  const url = isEdit ? `${API_BASE_URL}/eventos/${editId}` : `${API_BASE_URL}/eventos`;
  const method = isEdit ? 'PUT' : 'POST';

  const bodyData = isEdit ? {
    empleado_id,
    tipo_evento_id,
    descripcion,
    resolucion,
    modificado_por_usuario_id: state.usuarioActual.id
  } : {
    empleado_id,
    tipo_evento_id,
    descripcion,
    resolucion,
    creado_por_usuario_id: state.usuarioActual.id
  };

  try {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyData)
    });
    const data = await res.json();
    if (res.ok) {
      alert(isEdit ? 'Evento actualizado en la BD!' : 'Evento creado!');
      cerrarModal('modal-evento');
      document.getElementById('form-evento').reset();
      cargarTodo();
    } else alert(`Error: ${data.message}`);
  } catch (err) { alert('Error de conexión'); }
}

async function guardarPerfil(e) {
  e.preventDefault();
  const password_actual = document.getElementById('perfil-pass-actual').value;
  const nueva_password = document.getElementById('perfil-pass-nueva').value;
  const foto_url = document.getElementById('perfil-foto-url').value.trim();

  try {
    const res = await fetch(`${API_BASE_URL}/auth/perfil/${state.usuarioActual.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password_actual, nueva_password, foto_url })
    });
    const data = await res.json();
    if (res.ok) {
      alert('Perfil actualizado correctamente!');
      state.usuarioActual = data.usuario;
      localStorage.setItem('rrhh_user', JSON.stringify(data.usuario));
      document.getElementById('perfil-pass-actual').value = '';
      document.getElementById('perfil-pass-nueva').value = '';
      mostrarApp();
    } else alert(`Error: ${data.message}`);
  } catch (err) { alert('Error de conexión'); }
}

async function guardarUsuarioAdminModal(e) {
  e.preventDefault();
  const editId = document.getElementById('usr-edit-id').value;
  const nombre_usuario = document.getElementById('usr-nombre').value.trim();
  const email = document.getElementById('usr-email').value.trim();
  const password = document.getElementById('usr-pass').value.trim();
  const rol = document.getElementById('usr-rol').value;
  const foto_url = document.getElementById('usr-foto').value.trim();

  const isEdit = Boolean(editId);
  const url = isEdit ? `${API_BASE_URL}/auth/usuarios/${editId}` : `${API_BASE_URL}/auth/crear-usuario`;
  const method = isEdit ? 'PUT' : 'POST';

  if (!isEdit && (!nombre_usuario || !email || !password || !rol)) {
    return alert('Complete los campos obligatorios (*)');
  }

  try {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombre_usuario,
        email,
        password,
        rol,
        foto_url,
        usuario_solicitante_id: state.usuarioActual.id,
        admin_usuario_id: state.usuarioActual.id
      })
    });
    const data = await res.json();
    if (res.ok) {
      alert(isEdit ? 'Usuario actualizado exitosamente!' : 'Usuario creado exitosamente!');
      cerrarModal('modal-usuario');
      document.getElementById('form-crear-usuario').reset();
      document.getElementById('usr-foto-file').value = '';
      document.getElementById('usr-foto').value = '';
      cargarUsuariosAdmin();
      cargarAuditoria();
    } else alert(`Error: ${data.message}`);
  } catch (err) { alert('Error de conexión'); }
}

async function generarReporteCruzado() {
  const fecha_desde = document.getElementById('rep-fecha-desde').value;
  const fecha_hasta = document.getElementById('rep-fecha-hasta').value;
  const empresa_id = document.getElementById('rep-empresa').value;
  const empleado_id = document.getElementById('rep-empleado').value;
  const tipo_evento_id = document.getElementById('rep-tipo-evento').value;

  const params = new URLSearchParams();
  if (fecha_desde) params.append('fecha_desde', fecha_desde);
  if (fecha_hasta) params.append('fecha_hasta', fecha_hasta);
  if (empresa_id) params.append('empresa_id', empresa_id);
  if (empleado_id) params.append('empleado_id', empleado_id);
  if (tipo_evento_id) params.append('tipo_evento_id', tipo_evento_id);

  try {
    const res = await fetch(`${API_BASE_URL}/eventos?${params.toString()}`);
    const data = await res.json();
    renderEventos(data.data || [], 'tbody-reportes');
  } catch (error) { alert('Error al filtrar el reporte.'); }
}
