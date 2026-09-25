/**
 * controllers/users.controller.js
 * ---------------------------------------------------------------
 * Gestión de usuarios del sistema (solo administrador): agregar
 * recepcionistas u otros administradores, activarlos/desactivarlos y
 * restablecer su contraseña. Nunca se borran: un usuario desactivado
 * conserva su historial (quién cobró, quién hizo cada cierre…).
 */
const bcrypt = require('bcryptjs');
const db = require('../db');
const config = require('../config');
const { newId } = require('../utils/ids');

const publico = u => ({
  id: u.id, username: u.username, nombre: u.nombre, role: u.role,
  activo: !!u.activo, foto: u.foto || null, created_at: u.created_at,
});

function adminsActivos(exceptoId) {
  return db.prepare(`SELECT COUNT(*) AS n FROM users WHERE role = 'admin' AND activo = 1 AND id != ?`).get(exceptoId).n;
}

/** GET /api/users */
function list(req, res) {
  const rows = db.prepare('SELECT * FROM users ORDER BY activo DESC, role ASC, nombre ASC').all();
  res.json({ users: rows.map(publico) });
}

/** POST /api/users — { nombre, username, password, role } */
function create(req, res) {
  const username = String(req.body.username).trim().toLowerCase();
  if (db.prepare('SELECT 1 FROM users WHERE username = ?').get(username)) {
    return res.status(409).json({ error: 'Ese nombre de usuario ya está en uso.' });
  }
  const user = {
    id: newId(), username,
    password_hash: bcrypt.hashSync(req.body.password, config.bcryptRounds),
    role: req.body.role === 'admin' ? 'admin' : 'recepcion',
    nombre: String(req.body.nombre).trim(),
    activo: 1, created_at: new Date().toISOString(),
  };
  db.prepare(`
    INSERT INTO users (id, username, password_hash, role, nombre, activo, created_at)
    VALUES (@id, @username, @password_hash, @role, @nombre, @activo, @created_at)
  `).run(user);
  res.status(201).json({ user: publico(user) });
}

/**
 * PATCH /api/users/:id — { nombre?, role?, activo?, password? }
 * Desactivar o cambiar la contraseña cierra de inmediato las sesiones
 * abiertas de ese usuario. Nadie puede desactivarse ni quitarse el rol
 * de administrador a sí mismo, y siempre queda al menos un admin activo.
 */
function update(req, res) {
  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!u) return res.status(404).json({ error: 'Usuario no encontrado.' });
  const esYo = u.id === req.user.sub;

  const nombre = req.body.nombre !== undefined ? String(req.body.nombre).trim() : u.nombre;
  const role = req.body.role !== undefined ? (req.body.role === 'admin' ? 'admin' : 'recepcion') : u.role;
  const activo = req.body.activo !== undefined ? (req.body.activo ? 1 : 0) : u.activo;

  if (esYo && (!activo || role !== 'admin')) {
    return res.status(409).json({ error: 'No puedes desactivarte ni quitarte el rol de administrador a ti mismo.' });
  }
  if (u.role === 'admin' && (role !== 'admin' || !activo) && adminsActivos(u.id) === 0) {
    return res.status(409).json({ error: 'Debe quedar al menos un administrador activo.' });
  }

  let hash = u.password_hash;
  let tv = u.token_version || 0;
  if (req.body.password) {
    hash = bcrypt.hashSync(req.body.password, config.bcryptRounds);
    tv += 1;
  }
  if (!activo && u.activo) tv += 1; // al desactivar, sus sesiones se cierran

  db.prepare('UPDATE users SET nombre = ?, role = ?, activo = ?, password_hash = ?, token_version = ? WHERE id = ?')
    .run(nombre, role, activo, hash, tv, u.id);
  res.json({ user: publico({ ...u, nombre, role, activo }) });
}

module.exports = { list, create, update };
