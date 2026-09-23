/**
 * controllers/reservations.controller.js
 * ---------------------------------------------------------------
 * Gestión de pre-reservas DESDE EL PANEL (staff). Estas rutas SI
 * piden sesión + rol: cualquier otra entrada pasa por /api/public.
 * El flujo: una pre-reserva llega 'pendiente' del sitio público y
 * el staff la confirma ('confirmada') o la cancela ('cancelada').
 * Confirmar NO hace check-in: eso sigue siendo un paso manual cuando
 * el huésped llega (mismo flujo de hoy). Sí asigna la habitación que
 * queda bloqueada por las 12 h de la reserva.
 */
const db = require('../db');
const { ventana, solapan } = require('../utils/ventana');
const realtime = require('../realtime');

const numeroDe = r => Number(String(r.numero).match(/\d+/)?.[0] || Infinity);

/** GET /api/reservations?estado=pendiente|confirmada|cancelada — listado para el panel. */
function list(req, res) {
  const estado = (req.query.estado || '').trim();
  const filas = estado
    ? db.prepare('SELECT * FROM reservations WHERE estado = ? ORDER BY checkin ASC, created_at DESC').all(estado)
    : db.prepare('SELECT * FROM reservations ORDER BY checkin ASC, created_at DESC').all();

  const rooms = db.prepare('SELECT id, numero FROM rooms').all();
  const roomNum = id => (rooms.find(r => r.id === id) || {}).numero || null;

  const reservations = filas.map(r => {
    const w = ventana(r.checkin, r.hora_ingreso);
    return { ...r, inicio: w.inicio, fin: w.fin, room_numero: roomNum(r.room_id) };
  });
  res.json({ reservations });
}

/**
 * PATCH /api/reservations/:id — confirmar o cancelar una pre-reserva.
 * Al confirmar se asigna la habitación libre más cercana (por número)
 * de la categoría cuyas ventanas de 12h NO se solapan con la ventana
 * de esta reserva. Si no queda ninguna → 409. Se devuelve `room` para
 * que el panel la resalte.
 */
function setEstado(req, res) {
  const reserva = db.prepare('SELECT * FROM reservations WHERE id = ?').get(req.params.id);
  if (!reserva) return res.status(404).json({ error: 'Pre-reserva no encontrada.' });

  const { estado } = req.body;
  let room = reserva.room_id
    ? db.prepare('SELECT * FROM rooms WHERE id = ?').get(reserva.room_id)
    : null;

  if (estado === 'confirmada' && !room) {
    const W = ventana(reserva.checkin, reserva.hora_ingreso);
    const candidatas = db.prepare(
      `SELECT * FROM rooms WHERE tipo = ? AND estado IN ('libre','limpieza')`
    ).all(reserva.tipo_habitacion).sort((a, b) => numeroDe(a) - numeroDe(b));

    const ocupados = db.prepare(
      `SELECT room_id, checkin, hora_ingreso FROM reservations
       WHERE estado = 'confirmada' AND room_id IS NOT NULL`
    ).all();

    room = candidatas.find(c => !ocupados.some(o => o.room_id === c.id &&
      solapan(W.inicio, W.fin, ventana(o.checkin, o.hora_ingreso).inicio, ventana(o.checkin, o.hora_ingreso).fin)
    )) || null;

    if (!room) {
      return res.status(409).json({ error: `No queda una habitación ${reserva.tipo_habitacion} libre para ese horario (12 h).` });
    }
  }

  db.prepare('UPDATE reservations SET estado = ?, room_id = ? WHERE id = ?').run(estado, room ? room.id : null, reserva.id);

  realtime.broadcast('reservations:changed', { reason: 'cambio_estado', reservation_id: reserva.id, estado });
  realtime.broadcast('rooms:changed', { reason: 'reserva_estado' });
  res.json({ ok: true, reservation: { ...reserva, estado, room_id: room ? room.id : null }, room });
}

module.exports = { list, setEstado };