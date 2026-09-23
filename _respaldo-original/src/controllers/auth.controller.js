const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const config = require('../config');

/**
 * POST /api/auth/login
 * body: { username, password, role }
 *
 * Por qué pedimos el rol en el login además del usuario:
 * en este sistema el mismo formulario de acceso se usa para dos
 * perfiles distintos (admin / recepción). Pedir el rol evita que
 * alguien intente "adivinar" con qué permiso entra un usuario válido.
 */
function login(req, res) {
  const { username, password, role } = req.body;

  const user = db.prepare(
    `SELECT * FROM users WHERE username = ? AND role = ? AND activo = 1`
  ).get(username, role);

  // Importante: si el usuario no existe, respondemos EXACTAMENTE el
  // mismo mensaje que si la contraseña fuera incorrecta. Si diéramos
  // mensajes distintos ("usuario no existe" vs "contraseña incorrecta")
  // estaríamos regalando información a quien intenta adivinar cuentas.
  const genericError = 'Usuario, rol o contraseña incorrectos.';
  if (!user) return res.status(401).json({ error: genericError });

  const passwordOk = bcrypt.compareSync(password, user.password_hash);
  if (!passwordOk) return res.status(401).json({ error: genericError });

  const token = jwt.sign(
    { sub: user.id, username: user.username, role: user.role, nombre: user.nombre },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn }
  );

  res.json({
    token,
    user: { id: user.id, username: user.username, role: user.role, nombre: user.nombre, foto: user.foto || null },
  });
}

/** GET /api/auth/me — confirma quién es el usuario del token actual. */
function me(req, res) {
  const user = db.prepare('SELECT id, username, role, nombre, foto FROM users WHERE id = ?').get(req.user.sub);
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado.' });
  res.json({ user });
}

/**
 * PATCH /api/auth/me — sección "Configuración": el admin o la
 * recepcionista pueden cambiar su propio nombre, su usuario, su foto
 * de perfil, y opcionalmente su contraseña.
 *
 * Por seguridad, cambiar la contraseña exige repetir la contraseña
 * ACTUAL — así, si alguien deja la sesión abierta en un equipo
 * compartido, no puede tomarse la cuenta con solo eso.
 */
function updateMe(req, res) {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.sub);
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado.' });

  const nombre = (req.body.nombre ?? user.nombre).toString().trim() || user.nombre;
  const username = (req.body.username ?? user.username).toString().trim().toLowerCase();
  const foto = req.body.foto !== undefined ? req.body.foto : user.foto;

  if (foto && typeof foto === 'string' && foto.length > config.maxAvatarBytes) {
    return res.status(400).json({ error: 'La foto es demasiado grande. Usa una imagen más liviana (máx. ~450 KB).' });
  }

  if (username !== user.username) {
    const existe = db.prepare('SELECT 1 FROM users WHERE username = ? AND id != ?').get(username, user.id);
    if (existe) return res.status(409).json({ error: 'Ese nombre de usuario ya está en uso.' });
  }

  let passwordHash = user.password_hash;
  const { password_actual, password_nueva } = req.body;
  if (password_nueva) {
    if (!password_actual || !bcrypt.compareSync(password_actual, user.password_hash)) {
      return res.status(401).json({ error: 'Tu contraseña actual no es correcta.' });
    }
    if (String(password_nueva).length < 6) {
      return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 6 caracteres.' });
    }
    passwordHash = bcrypt.hashSync(password_nueva, 10);
  }

  db.prepare('UPDATE users SET nombre = ?, username = ?, foto = ?, password_hash = ? WHERE id = ?')
    .run(nombre, username, foto || null, passwordHash, user.id);

  // El token viejo tiene el nombre/usuario anteriores grabados en su firma:
  // emitimos uno nuevo para que el panel se actualice sin pedir login otra vez.
  const token = jwt.sign(
    { sub: user.id, username, role: user.role, nombre },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn }
  );

  res.json({ token, user: { id: user.id, username, role: user.role, nombre, foto: foto || null } });
}

module.exports = { login, me, updateMe };
