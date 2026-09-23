/**
 * controllers/public.controller.js
 * ---------------------------------------------------------------
 * La cara pública de la API (SIN autenticación, a propósito).
 * Solo expone datos NO sensibles (tipo de habitación, precio y
 * conteos) y crea PRE-RESERVAS en estado 'pendiente'.
 * Jamás devuelve huéspedes, DNIs, finanzas ni inventario: quien
 * quiera esas cosas pasa por el panel con su token (requireAuth).
 */
const db = require('../db');
const { newId } = require('../utils/ids');
const { ventana, solapan, ahora } = require('../utils/ventana');
const realtime = require('../realtime');

const nowISO = () => new Date().toISOString();
const { hoy: today } = require('../utils/fechas');

/**
 * Cuántas unidades "vendibles" quedan de un tipo para la ventana de 12h
 * que empieza el `checkin` a la `hora`. Pool = habitaciones del tipo en
 * 'libre'/'limpieza'; se restan las pre-reservas pendientes con ventana
 * solapada (1 unidad cada una) y las confirmadas que bloquean una
 * habitación del pool (esas sí tienen room_id asignado).
 */
function disponibles(tipo, checkin, hora) {
  const W = ventana(checkin, hora);
  const rooms = db.prepare(
    `SELECT id, estado FROM rooms WHERE tipo = ?
       AND estado IN ('libre','limpieza')`
  ).all(tipo);
  let libres = rooms.length;
  const bloqueadas = new Set();

  const filas = db.prepare(
    `SELECT id, estado, checkin, hora_ingreso, room_id
     FROM reservations
     WHERE tipo_habitacion = ? AND estado IN ('pendiente','confirmada')`
  ).all(tipo);

  for (const r of filas) {
    const w = ventana(r.checkin, r.hora_ingreso);
    if (!solapan(W.inicio, W.fin, w.inicio, w.fin)) continue;
    if (r.estado === 'pendiente') {
      libres--;
    } else if (r.room_id && !bloqueadas.has(r.room_id)) {
      // confirmada con habitación asignada: saca esa habitación del pool.
      // Si lleva ya huésped (estado no libre) ya no contaba en el pool.
      if (rooms.some(x => x.id === r.room_id)) {
        bloqueadas.add(r.room_id);
        libres--;
      }
    }
  }
  return Math.max(0, libres);
}

/**
 * GET /api/public/rooms-availability?fecha=YYYY-MM-DD&hora=0-23
 * Disponibilidad FUTURA por tipo de habitación, pensada para el sitio
 * público, por bloques de 12 horas contados desde la hora elegida.
 * Si no llegan parámetros: hoy a la hora actual.
 * ponytail: no predice futuros check-out de habitaciones ocupadas;
 *           son pre-reservas que el staff confirma, suficiente para v1.
 */
function availability(req, res) {
  const fecha = (req.query.fecha || '').trim() || today();
  const horaRaw = req.query.hora;
  const hora = horaRaw !== undefined && horaRaw !== ''
    ? parseInt(horaRaw, 10)
    : new Date().getHours();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return res.status(400).json({ error: 'La fecha debe tener formato AAAA-MM-DD.' });
  }
  if (!Number.isInteger(hora) || hora < 0 || hora > 23) {
    return res.status(400).json({ error: 'La hora de ingreso debe ser un número entre 0 y 23.' });
  }

  const oferta = db.prepare('SELECT tipo, MIN(precio) AS precio, COUNT(*) AS total FROM rooms GROUP BY tipo ORDER BY tipo')
    .all()
    .map(r => ({
      tipo: r.tipo,
      precio: r.precio,
      total: r.total,
      disponibles: disponibles(r.tipo, fecha, hora),
    }));

  res.json({ fecha, hora, habitaciones: oferta });
}

/**
 * GET /api/public/tarifario
 * Lista los tipos de habitación con su precio (el menor, como "desde"),
 * para la sección "Nuestras habitaciones" del sitio público.
 */
function tarifario(req, res) {
  const habitaciones = db.prepare('SELECT tipo, MIN(precio) AS precio, COUNT(*) AS total FROM rooms GROUP BY tipo ORDER BY tipo').all();
  res.json({ habitaciones });
}

/**
 * POST /api/public/reservations
 * Crea una PRE-RESERVA desde el sitio público. Nunca toca el estado
 * real de una habitación ni crea estancias: entra 'pendiente' y queda
 * a la espera de que el staff la confirme desde el panel. La ventana
 * de ocupación son 12 horas desde la hora de ingreso elegida. Antes de
 * guardar re-verifica disponibilidad (el check+insert son síncronos:
 * no hay doble reserva simultánea).
 */
function createReservation(req, res) {
  const {
    tipo_habitacion, checkin, hora_ingreso,
    nombre, telefono, email,
  } = req.body;

  if (disponibles(tipo_habitacion, checkin, hora_ingreso) <= 0) {
    return res.status(409).json({ error: `No queda disponibilidad para la habitación ${tipo_habitacion} en ese horario.` });
  }

  const W = ventana(checkin, hora_ingreso);
  const row = {
    id: newId(),
    tipo_habitacion,
    cantidad: 1,
    checkin, checkout: W.fin.slice(0, 10),
    hora_ingreso: Number(hora_ingreso),
    room_id: null,
    nombre: String(nombre).trim(),
    telefono: (telefono || '').trim() || null,
    email: (email || '').trim() || null,
    estado: 'pendiente',
    created_at: nowISO(),
  };

  db.prepare(`
    INSERT INTO reservations (id, tipo_habitacion, cantidad, checkin, checkout, hora_ingreso, room_id, nombre, telefono, email, estado, created_at)
    VALUES (@id, @tipo_habitacion, @cantidad, @checkin, @checkout, @hora_ingreso, @room_id, @nombre, @telefono, @email, @estado, @created_at)
  `).run(row);

  realtime.broadcast('reservations:changed', { reason: 'nueva_pre_reserva', reservation_id: row.id });
  res.status(201).json({
    ok: true,
    codigo: row.id.slice(0, 6).toUpperCase(),
    inicio: W.inicio,
    fin: W.fin,
    horas: 12,
    mensaje: 'Pre-reserva registrada. El hostal confirmará tu disponibilidad.',
  });
}

module.exports = { availability, tarifario, createReservation };