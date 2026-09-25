const bcrypt = require('bcryptjs');
const db = require('../db');
const config = require('../config');
const { signToken } = require('../middleware/auth');

// Hash "señuelo": si el usuario no existe igual comparamos contra esto,
// para que la respuesta tarde lo mismo exista o no la cuenta (así nadie
// puede averiguar qué usuarios existen midiendo el tiempo de respuesta).
const DUMMY_HASH = bcrypt.hashSync('hostal-dorado-dummy', 10);

// Solo aceptamos imágenes base64 reales (sin comillas ni nada que pueda
// "romper" el atributo src del <img> donde se muestran).
const AVATAR_RE = /^data:image\/(png|jpe?g|webp);base64,[A-Za-z0-9+/]+=*$/;

/** ¿El usuario sigue usando la contraseña de fábrica? El panel muestra un aviso. */
function usaPasswordDeFabrica(user) {
  return config.defaultPasswords.some(p => bcrypt.compareSync(p, user.password_hash));
}

function publicUser(user, extra = {}) {
  return { id: user.id, username: user.username, role: user.role, nombre: user.nombre, foto: user.foto || null, ...extra };
}

/**
 * POST /api/auth/login
 * body: { username, password, role? }
 *
 * El rol sale de la propia cuenta: cada usuario es admin o recepción,
 * así que no hace falta que la persona lo elija al entrar. `role` sigue
 * aceptándose (opcional) por compatibilidad con clientes antiguos.
 */
function login(req, res) {
  const { username, password, role } = req.body;

  const user = role
    ? db.prepare('SELECT * FROM users WHERE username = ? AND role = ? AND activo = 1').get(String(username).toLowerCase(), role)
    : db.prepare('SELECT * FROM users WHERE username = ? AND activo = 1').get(String(username).toLowerCase());

  // Importante: si el usuario no existe, respondemos EXACTAMENTE el
  // mismo mensaje que si la contraseña fuera incorrecta.
  const genericError = 'Usuario o contraseña incorrectos.';
  const passwordOk = bcrypt.compareSync(password, user ? user.password_hash : DUMMY_HASH);
  if (!user || !passwordOk) return res.status(401).json({ error: genericError });

  // Si el hash se creó con menos rondas que las actuales, lo reforzamos ahora
  // que tenemos la contraseña en claro (migración transparente).
  if (bcrypt.getRounds(user.password_hash) < config.bcryptRounds) {
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?')
      .run(bcrypt.hashSync(password, config.bcryptRounds), user.id);
  }

  res.json({
    token: signToken(user),
    user: publicUser(user, { passwordPorDefecto: config.defaultPasswords.includes(password) }),
  });
}

/** GET /api/auth/me — confirma quién es el usuario del token actual. */
function me(req, res) {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.sub);
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado.' });
  res.json({ user: publicUser(user, { passwordPorDefecto: usaPasswordDeFabrica(user) }) });
}

/**
 * PATCH /api/auth/me — sección "Configuración": el admin o la
 * recepcionista pueden cambiar su propio nombre, su usuario, su foto
 * de perfil, y opcionalmente su contraseña.
 *
 * Por seguridad, cambiar la contraseña exige repetir la contraseña
 * ACTUAL — así, si alguien deja la sesión abierta en un equipo
 * compartido, no puede tomarse la cuenta con solo eso. Además, al
 * cambiarla se cierran las sesiones abiertas en otros equipos.
 */
function updateMe(req, res) {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.sub);
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado.' });

  const nombre = (req.body.nombre ?? user.nombre).toString().trim() || user.nombre;
  const username = (req.body.username ?? user.username).toString().trim().toLowerCase();
  const foto = req.body.foto !== undefined ? req.body.foto : user.foto;

  if (foto && (typeof foto !== 'string' || !AVATAR_RE.test(foto))) {
    return res.status(400).json({ error: 'La foto debe ser una imagen JPG, PNG o WebP válida.' });
  }
  if (foto && foto.length > config.maxAvatarBytes) {
    return res.status(400).json({ error: 'La foto es demasiado grande. Usa una imagen más liviana (máx. ~450 KB).' });
  }

  if (username !== user.username) {
    const existe = db.prepare('SELECT 1 FROM users WHERE username = ? AND id != ?').get(username, user.id);
    if (existe) return res.status(409).json({ error: 'Ese nombre de usuario ya está en uso.' });
  }

  let passwordHash = user.password_hash;
  let tokenVersion = user.token_version || 0;
  const { password_actual, password_nueva } = req.body;
  if (password_nueva) {
    if (!password_actual || !bcrypt.compareSync(password_actual, user.password_hash)) {
      return res.status(401).json({ error: 'Tu contraseña actual no es correcta.' });
    }
    if (String(password_nueva).length < 8) {
      return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 8 caracteres.' });
    }
    if (config.defaultPasswords.includes(password_nueva)) {
      return res.status(400).json({ error: 'Elige una contraseña distinta a la de fábrica.' });
    }
    passwordHash = bcrypt.hashSync(password_nueva, config.bcryptRounds);
    tokenVersion += 1;
  }

  db.prepare('UPDATE users SET nombre = ?, username = ?, foto = ?, password_hash = ?, token_version = ? WHERE id = ?')
    .run(nombre, username, foto || null, passwordHash, tokenVersion, user.id);

  const actualizado = { ...user, nombre, username, foto: foto || null, token_version: tokenVersion, password_hash: passwordHash };
  // Emitimos un token nuevo (con la versión de sesión actual) para que este
  // equipo siga conectado sin pedir login otra vez.
  res.json({
    token: signToken(actualizado),
    user: publicUser(actualizado, { passwordPorDefecto: password_nueva ? false : usaPasswordDeFabrica(actualizado) }),
  });
}

module.exports = { login, me, updateMe };
