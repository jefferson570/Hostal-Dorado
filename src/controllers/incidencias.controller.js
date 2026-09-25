/**
 * controllers/incidencias.controller.js
 * ---------------------------------------------------------------
 * Incidencias del hostal registradas desde el modal de acciones
 * rápidas del panel. El reporte lleva fecha y hora automática del
 * servidor (created_at ISO completo) y el autor de la sesión.
 */
const db = require('../db');
const realtime = require('../realtime');
const { newId } = require('../utils/ids');

const ESTADOS = ['abierta', 'en_revision', 'resuelta'];

/** GET /api/incidencias[?estado=] — filtrado opcional, más recientes primero. */
function list(req, res) {
  const estado = (req.query.estado || '').trim();
  const incidencias = estado && ESTADOS.includes(estado)
    ? db.prepare('SELECT * FROM incidencias WHERE estado = ? ORDER BY created_at DESC, rowid DESC').all(estado)
    : db.prepare('SELECT * FROM incidencias ORDER BY created_at DESC, rowid DESC').all();
  res.json({ incidencias });
}

/** POST /api/incidencias — registra una incidencia con hora automática. */
function create(req, res) {
  const { tipo, ubicacion, habitacion_num, detalle } = req.body;
  if (!tipo || !String(tipo).trim()) {
    return res.status(400).json({ error: 'Selecciona el tipo de incidente.' });
  }
  if (!ubicacion || !String(ubicacion).trim()) {
    return res.status(400).json({ error: 'Indica el lugar del hostal.' });
  }
  const incidencia = {
    id: newId(),
    tipo: String(tipo).trim(),
    ubicacion: String(ubicacion).trim(),
    habitacion_num: habitacion_num ? String(habitacion_num).trim() : null,
    detalle: detalle ? String(detalle).trim().slice(0, 500) : null,
    estado: 'abierta',
    reportado_por: req.user.nombre,
    created_at: new Date().toISOString(),
  };
  db.prepare(`INSERT INTO incidencias
    (id, tipo, ubicacion, habitacion_num, detalle, estado, reportado_por, created_at)
    VALUES (@id, @tipo, @ubicacion, @habitacion_num, @detalle, @estado, @reportado_por, @created_at)`).run(incidencia);
  realtime.broadcast('incidencias:changed', { id: incidencia.id });
  res.status(201).json({ incidencia });
}

/** PATCH /api/incidencias/:id — avanza/reabre el estado. */
function setEstado(req, res) {
  const inc = db.prepare('SELECT * FROM incidencias WHERE id = ?').get(req.params.id);
  if (!inc) return res.status(404).json({ error: 'Incidencia no encontrada.' });

  db.prepare('UPDATE incidencias SET estado = ? WHERE id = ?').run(req.body.estado, inc.id);
  realtime.broadcast('incidencias:changed', { id: inc.id, estado: req.body.estado });
  res.json({ ok: true, estado: req.body.estado });
}

module.exports = { list, create, setEstado };