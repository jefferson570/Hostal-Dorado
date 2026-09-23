/**
 * config.js
 * ---------------------------------------------------------------
 * Punto único donde el resto del backend lee la configuración.
 * Nunca uses `process.env.X` directamente en otros archivos:
 * así, si mañana cambias de dónde vienen las variables (por ejemplo,
 * a un gestor de secretos en un servidor real), solo tocas este archivo.
 */
require('dotenv').config();

// Zona horaria del hostal: todas las fechas ("hoy", ventanas de reserva,
// cierres de caja) se calculan en hora de Perú aunque el servidor esté
// en otro país (Render, Railway, etc. corren en UTC).
process.env.TZ = process.env.TZ || 'America/Lima';

const isProd = process.env.NODE_ENV === 'production';
const DEFAULT_JWT_SECRET = 'clave-de-desarrollo-no-usar-en-produccion';

// Seguridad: si alguien despliega esto en producción sin cambiar el
// JWT_SECRET, cualquiera podría fabricar tokens válidos con la clave
// por defecto (que es pública, está en este mismo código). Preferimos
// que el servidor NO arranque a que arranque inseguro en silencio.
if (isProd && (!process.env.JWT_SECRET || process.env.JWT_SECRET === DEFAULT_JWT_SECRET)) {
  console.error('✖ JWT_SECRET no está configurado (o usa el valor de desarrollo) en producción.');
  console.error('  Genera uno con: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"');
  process.exit(1);
}

module.exports = {
  isProd,
  port: process.env.PORT || 3000,
  jwtSecret: process.env.JWT_SECRET || DEFAULT_JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',
  dbPath: process.env.DB_PATH || './data/hostal.db',
  // Orígenes permitidos para CORS. En dev ambos frontales viven en el
  // mismo servidor (origen único), así que el default no rompe nada.
  // En producción define CORS_ORIGINS con los dominios exactos (panel y sitio público).
  corsOrigins: process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map(s => s.trim())
    : ['http://localhost:3000', 'http://127.0.0.1:3000'],
  // Tamaño máximo de la foto de perfil guardada en base64 (bytes aprox. del string).
  maxAvatarBytes: 600 * 1024,
  // Detrás de un proxy (Render, Railway, Nginx) la IP real del cliente viene
  // en X-Forwarded-For: sin esto el rate-limit vería a todos como una sola IP.
  // (TRUST_PROXY=0 en una instalación local sin proxy, como la PC de recepción).
  trustProxy: process.env.TRUST_PROXY !== undefined && process.env.TRUST_PROXY !== ''
    ? (Number(process.env.TRUST_PROXY) || 0)
    : (isProd ? 1 : 0),
  // Respaldo automático diario de la base de datos (copias de los últimos N días).
  backupDir: process.env.BACKUP_DIR || './data/respaldos',
  backupKeep: Number(process.env.BACKUP_KEEP) || 30,
  // Contraseñas iniciales de los usuarios semilla. Solo se usan la PRIMERA
  // vez que se crea la base de datos; después se cambian desde el panel.
  seedAdminPassword: process.env.ADMIN_PASSWORD || 'admin123',
  seedRecepcionPassword: process.env.RECEPCION_PASSWORD || 'recep123',
  defaultPasswords: ['admin123', 'recep123'],
  bcryptRounds: 12,
};
