/**
 * server.js
 * ---------------------------------------------------------------
 * Punto de entrada de toda la aplicación. Aquí se junta todo:
 *   - Express sirve la API (/api/...) y el frontend estático (public/)
 *   - http.createServer envuelve a Express porque Socket.io necesita
 *     acceso directo al servidor HTTP para poder "escuchar" conexiones
 *     en tiempo real (WebSockets), no solo peticiones normales.
 *   - Socket.io permite que el servidor avise a todos los navegadores
 *     conectados cuando algo cambia (una habitación, una venta, etc.)
 */
const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');
const { Server } = require('socket.io');

const config = require('./src/config');
const db = require('./src/db'); // al importarlo, se crea/migra la base de datos y se siembra
const realtime = require('./src/realtime');
const { userFromToken } = require('./src/middleware/auth');

const authRoutes = require('./src/routes/auth.routes');
const roomsRoutes = require('./src/routes/rooms.routes');
const guestsRoutes = require('./src/routes/guests.routes');
const financeRoutes = require('./src/routes/finance.routes');
const inventoryRoutes = require('./src/routes/inventory.routes');
const exportRoutes = require('./src/routes/export.routes');
const reservationsRoutes = require('./src/routes/reservations.routes');
const notasRoutes = require('./src/routes/notas.routes');
const incidenciasRoutes = require('./src/routes/incidencias.routes');
const employeesRoutes = require('./src/routes/employees.routes');
const scheduleRoutes = require('./src/routes/schedule.routes');
const publicRoutes = require('./src/routes/public.routes');
const errorHandler = require('./src/middleware/errorHandler');

const app = express();
app.set('trust proxy', config.trustProxy);
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: config.corsOrigins } });
realtime.init(io);

/* ---------- Cabeceras de seguridad ---------- */
// Content-Security-Policy: el navegador SOLO ejecuta scripts servidos por
// este mismo servidor. Aunque alguien lograra colar HTML malicioso en un
// dato (nombre de huésped, nota…), el navegador se negaría a ejecutarlo.
app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: false,
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      // Las fuentes van alojadas en /fonts: el navegador del visitante no
      // contacta a Google Fonts (un tercero menos que recibe su IP).
      styleSrc: ["'self'", "'unsafe-inline'"],
      fontSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'blob:'],
      connectSrc: ["'self'"],
      // Único tercero embebido: el mapa de Google, y solo tras el consentimiento.
      frameSrc: ['https://www.google.com', 'https://maps.google.com'],
      frameAncestors: ["'self'"],
      formAction: ["'self'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      // Sin upgrade-insecure-requests: el panel también se usa por la red
      // local (http://192.168.x.x) desde el celular de recepción.
    },
  },
  crossOriginEmbedderPolicy: false,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
}));
app.use((req, res, next) => {
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  next();
});

// CORS limitado a los orígenes de ambos frontales (config.corsOrigins).
app.use(cors({ origin: config.corsOrigins }));

// Límite general anti-abuso para toda la API. Es generoso a propósito:
// todo el personal del hostal suele salir a internet con la MISMA IP.
app.use('/api', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas peticiones. Espera un momento e intenta de nuevo.' },
}));

// Límite de tamaño del body: la foto de perfil va en base64 (solo en /api/auth),
// todo lo demás son formularios pequeños.
app.use('/api/auth', express.json({ limit: '1mb' }));
app.use(express.json({ limit: '100kb' }));
// En producción solo se registran errores, para que el log no crezca sin fin.
app.use(morgan(config.isProd ? 'tiny' : 'dev', { skip: (req, res) => config.isProd && res.statusCode < 400 }));

// Las respuestas de la API nunca deben quedar guardadas en cachés
// intermedias (contienen datos de huéspedes y de caja).
app.use('/api', (req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });

/* ---------- API ---------- */
app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomsRoutes);
app.use('/api/guests', guestsRoutes);
app.use('/api/finance', financeRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/reservations', reservationsRoutes);
app.use('/api/notas', notasRoutes);
app.use('/api/incidencias', incidenciasRoutes);
app.use('/api/employees', employeesRoutes);
app.use('/api/schedule', scheduleRoutes);
const { cajaRouter, compRouter, usersRouter, ajustesRouter } = require('./src/routes/caja.routes');
app.use('/api/caja', cajaRouter);
app.use('/api/comprobantes', compRouter);
app.use('/api/users', usersRouter);
app.use('/api/ajustes', ajustesRouter);
// Rutas públicas (sitio web): SIN auth, solo disponibilidad y pre-reservas.
app.use('/api/public', publicRoutes);
app.get('/api/health', (req, res) => res.json({ ok: true }));
// Cualquier otra ruta /api (con cualquier método) → 404 en JSON.
app.use('/api', (req, res) => res.status(404).json({ error: 'Ruta no encontrada.' }));

/* ---------- Frontends ----------
   "/"       → sitio público (lo que ve cualquier visitante de la web)
   "/panel"  → panel del personal (login con usuario y contraseña)
   Los recursos (css, js, img, fonts) de ambos se sirven por ruta absoluta. */
const staticOpts = { maxAge: config.isProd ? '1h' : 0, index: false };
const SITIO = path.join(__dirname, 'public-site');
const PANEL = path.join(__dirname, 'public');

app.use(express.static(PANEL, staticOpts));
app.use('/sitio', express.static(SITIO, staticOpts));

// Contacto para reportar fallas de seguridad (estándar RFC 9116).
app.get('/.well-known/security.txt', (req, res) => {
  res.type('text/plain').sendFile(path.join(SITIO, 'security.txt'));
});

/* Para buscadores (Google): qué indexar y el mapa del sitio. Se arman con
   el dominio de la petición, así sirven igual en onrender.com o en un
   dominio propio. El panel del personal queda fuera de los buscadores. */
const PAGINAS_PUBLICAS = ['/', '/privacidad', '/cookies', '/terminos', '/seguridad'];
const baseUrl = req => `${req.protocol}://${req.get('host')}`;
app.get('/robots.txt', (req, res) => {
  res.type('text/plain').send(`User-agent: *\nAllow: /\nDisallow: /panel\nDisallow: /api/\n\nSitemap: ${baseUrl(req)}/sitemap.xml\n`);
});
app.get('/sitemap.xml', (req, res) => {
  const urls = PAGINAS_PUBLICAS.map(p => `  <url><loc>${baseUrl(req)}${p}</loc></url>`).join('\n');
  res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`);
});

app.get('/', (req, res) => res.sendFile(path.join(SITIO, 'index.html')));
app.get(/^\/(privacidad|cookies|terminos|seguridad)\/?$/, (req, res) => {
  res.sendFile(path.join(SITIO, `${req.params[0]}.html`));
});
app.get(/^\/panel(\/.*)?$/, (req, res) => res.sendFile(path.join(PANEL, 'index.html')));
// Enlaces antiguos a /sitio siguen funcionando.
app.get(/^\/sitio\/?$/, (req, res) => res.redirect(301, '/'));

// Cualquier otra ruta: página 404 del sitio.
app.use((req, res) => res.status(404).sendFile(path.join(SITIO, '404.html')));

/* ---------- Manejo de errores (siempre al final) ---------- */
app.use(errorHandler);

/* ---------- Socket.io ----------
   Solo el personal con sesión válida recibe los avisos en tiempo real:
   el navegador manda su token al conectarse y aquí se verifica igual
   que en la API. */
io.use((socket, next) => {
  const user = userFromToken(socket.handshake.auth && socket.handshake.auth.token);
  if (!user) return next(new Error('unauthorized'));
  socket.data.user = { id: user.id, nombre: user.nombre };
  next();
});
io.on('connection', (socket) => {
  if (!config.isProd) console.log(`🔌 ${socket.data.user.nombre} conectado en tiempo real (${socket.id})`);
  socket.on('disconnect', () => { if (!config.isProd) console.log(`🔌 Desconectado: ${socket.id}`); });
});

require('./src/backup/autoBackup').iniciar(db);
require('./src/utils/retencion').iniciar(db);

server.listen(config.port, () => {
  console.log(`\n🏨  Hostal Dorado — servidor corriendo en http://localhost:${config.port}`);
  console.log(`    Sitio público:      http://localhost:${config.port}/`);
  console.log(`    Panel del personal: http://localhost:${config.port}/panel\n`);
});

/* ---------- Cierre ordenado ----------
   Al detener el servidor (Ctrl+C o un redeploy) cerramos la base de datos
   correctamente para que el archivo WAL quede consolidado. */
let cerrando = false;
function apagar(signal) {
  if (cerrando) return;
  cerrando = true;
  console.log(`\n${signal} recibido — cerrando el servidor…`);
  // io.close() también cierra el servidor HTTP que envuelve.
  io.close(() => {
    try { db.pragma('wal_checkpoint(TRUNCATE)'); db.close(); } catch (_) { /* ya cerrada */ }
    process.exit(0);
  });
  setTimeout(() => process.exit(0), 5000).unref();
}
process.on('SIGINT', () => apagar('SIGINT'));
process.on('SIGTERM', () => apagar('SIGTERM'));
