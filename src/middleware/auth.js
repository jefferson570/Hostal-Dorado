/**
 * middleware/auth.js
 * ---------------------------------------------------------------
 * Autenticación con JWT (JSON Web Token):
 *   1) El usuario envía usuario+contraseña a /api/auth/login.
 *   2) El servidor verifica la contraseña y, si es correcta, firma
 *      un "token" (un texto cifrado con la clave JWT_SECRET) que
 *      contiene el id del usuario y la versión de su sesión.
 *   3) El navegador guarda ese token y lo manda en cada petición
 *      siguiente dentro del header "Authorization: Bearer <token>".
 *   4) Este middleware verifica la firma del token Y que el usuario
 *      siga existiendo y activo en la base de datos.
 *
 * Por qué no basta con verificar la firma: si la base de datos se
 * reinstala, se desactiva a un empleado o alguien cambia su
 * contraseña, un token viejo seguiría "siendo válido" y apuntaría a
 * un usuario que ya no existe (eso provocaba el error
 * "FOREIGN KEY constraint failed" al registrar ventas). Ahora el rol y
 * el nombre se leen SIEMPRE de la base de datos, nunca del token.
 */
const jwt = require('jsonwebtoken');
const db = require('../db');
const config = require('../config');

const findUser = db.prepare('SELECT id, username, role, nombre, activo, token_version FROM users WHERE id = ?');

function signToken(user) {
  return jwt.sign(
    { sub: user.id, tv: user.token_version || 0 },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn, algorithm: 'HS256' }
  );
}

/** Devuelve el usuario vigente del token, o null si el token ya no sirve. */
function userFromToken(token) {
  let payload;
  try {
    // Fijamos el algoritmo: evita ataques de "algorithm confusion" (alg: none, etc.).
    payload = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] });
  } catch (_) {
    return null;
  }
  const user = findUser.get(payload.sub);
  if (!user || !user.activo) return null;
  if ((payload.tv || 0) !== (user.token_version || 0)) return null; // contraseña cambiada → sesiones viejas fuera
  return user;
}

function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'No has iniciado sesión o tu sesión expiró.' });
  }

  const user = userFromToken(token);
  if (!user) {
    return res.status(401).json({ error: 'Tu sesión ya no es válida. Vuelve a iniciar sesión.' });
  }
  req.user = { sub: user.id, username: user.username, role: user.role, nombre: user.nombre };
  next();
}

/**
 * requireRole('admin') sólo deja pasar a administradores.
 * requireRole('admin', 'recepcion') deja pasar a ambos (equivale a "cualquiera autenticado").
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'No autenticado.' });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'No tienes permisos para realizar esta acción.' });
    }
    next();
  };
}

module.exports = { requireAuth, requireRole, signToken, userFromToken };
