/**
 * middleware/auth.js
 * ---------------------------------------------------------------
 * Autenticación con JWT (JSON Web Token):
 *   1) El usuario envía usuario+contraseña a /api/auth/login.
 *   2) El servidor verifica la contraseña y, si es correcta, firma
 *      un "token" (un texto cifrado con la clave JWT_SECRET) que
 *      contiene el id, usuario y rol de la persona.
 *   3) El navegador guarda ese token y lo manda en cada petición
 *      siguiente dentro del header "Authorization: Bearer <token>".
 *   4) Este middleware verifica la firma del token en cada petición
 *      protegida — así el servidor NUNCA necesita "recordar" quién
 *      inició sesión: toda la información va firmada en el propio
 *      token (por eso se dice que JWT es "sin estado" / stateless).
 */
const jwt = require('jsonwebtoken');
const config = require('../config');

function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'No has iniciado sesión o tu sesión expiró.' });
  }

  try {
    const payload = jwt.verify(token, config.jwtSecret);
    req.user = payload; // { sub, username, role, nombre }
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Sesión inválida o expirada. Vuelve a iniciar sesión.' });
  }
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

module.exports = { requireAuth, requireRole };
