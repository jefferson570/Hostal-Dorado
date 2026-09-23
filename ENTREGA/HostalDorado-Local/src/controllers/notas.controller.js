/**
 * controllers/notas.controller.js
 * ---------------------------------------------------------------
 * Notas internas del staff (panel lateral de Resumen). Solo
 * requieren sesión para ver/crear; el autor sale de req.user, no
 * del body, así nadie puede firmar una nota como otro usuario.
 */
const db = require('../db');
const realtime = require('../realtime');
const { newId } = require('../utils/ids');
const { hoy } = require('../utils/fechas');

/** GET /api/notas — últimas 50, más recientes primero. */
function list(req, res) {
  const notas = db.prepare('SELECT * FROM notas ORDER BY created_at DESC, rowid DESC LIMIT 50').all();
  res.json({ notas });
}

/** POST /api/notas — crea una nota firmada por quien está logueado. */
function create(req, res) {
  const { texto } = req.body;
  if (!texto || !String(texto).trim()) {
    return res.status(400).json({ error: 'El texto de la nota es obligatorio.' });
  }
  const nota = {
    id: newId(),
    texto: String(texto).trim().slice(0, 500),
    autor: req.user.nombre,
    // Fecha corta (YYYY-MM-DD) a propósito: toda la app maneja fechas así
    // y fmtDate en el panel la formatea con el mediodía UTC de respaldo.
    created_at: hoy(),
  };
  db.prepare('INSERT INTO notas (id, texto, autor, created_at) VALUES (@id, @texto, @autor, @created_at)').run(nota);
  realtime.broadcast('notas:changed', { id: nota.id });
  res.status(201).json({ nota });
}

module.exports = { list, create };