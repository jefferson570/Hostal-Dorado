const db = require('../db');
const { newId } = require('../utils/ids');
const { ventana, ahora } = require('../utils/ventana');
const realtime = require('../realtime');
const sheets = require('../backup/googleSheets');

const nowISO = () => new Date().toISOString();
const today = () => new Date().toISOString().slice(0, 10);

/** GET /api/rooms — mapa de habitaciones con el huésped activo (si tiene). */
function list(req, res) {
  const rooms = db.prepare(`
    SELECT
      r.*,
      s.id            AS stay_id,
      s.checkin_date  AS stay_checkin,
      s.nights        AS stay_nights,
      s.created_at    AS stay_created_at,
      g.nombres       AS guest_nombres,
      g.apellidos     AS guest_apellidos,
      g.tipo_documento AS guest_tipo_documento,
      g.numero_documento AS guest_numero_documento
    FROM rooms r
    LEFT JOIN stays s ON s.room_id = r.id AND s.estado = 'activa'
    LEFT JOIN guests g ON g.id = s.guest_id
    ORDER BY CAST(r.numero AS INTEGER)
  `).all();

  // Reservas confirmadas con habitación asignada: ventana de 12h que
  // cubre "ahora" = bloqueo activo; la siguiente con fin > ahora = futura.
  const ahoraISO = ahora();
  const reservas = db.prepare(
    `SELECT id, checkin, hora_ingreso, room_id, nombre FROM reservations
     WHERE estado = 'confirmada' AND room_id IS NOT NULL`
  ).all().map(r => ({ ...r, ...ventana(r.checkin, r.hora_ingreso) }));

  const porRoom = {};
  for (const r of reservas) (porRoom[r.room_id] || (porRoom[r.room_id] = [])).push(r);
  for (const k of Object.keys(porRoom)) porRoom[k].sort((a, b) => a.inicio.localeCompare(b.inicio));

  const listo = rooms.map(r => {
    // El bloqueo solo se reporta en habitaciones 'libre': si el staff
    // cambia el estado (limpieza/mantenimiento) de forma manual, el
    // bloqueo de la reserva deja de contar = liberación manual.
    const cands = r.estado === 'libre' ? porRoom[r.id] || [] : [];
    const reserva = cands.find(c => c.fin > ahoraISO);
    return {
      ...r,
      reserva_inicio: reserva ? reserva.inicio : null,
      reserva_fin: reserva ? reserva.fin : null,
      reserva_nombre: reserva ? reserva.nombre : null,
      reserva_codigo: reserva ? reserva.id.slice(0, 6).toUpperCase() : null,
    };
  });
  res.json({ rooms: listo });
}

/** POST /api/rooms — crear habitación (solo admin). */
function create(req, res) {
  const { numero, tipo, categoria, unidad, bloque_horas, precio } = req.body;
  const room = {
    id: newId(), numero: String(numero).trim(), tipo, categoria: categoria || tipo,
    unidad: unidad === 'hora' ? 'hora' : 'noche',
    bloque_horas: unidad === 'hora' ? (parseInt(bloque_horas, 10) || 3) : null,
    precio: Number(precio), estado: 'libre', created_at: nowISO(),
  };
  try {
    db.prepare(`
      INSERT INTO rooms (id, numero, tipo, categoria, unidad, bloque_horas, precio, estado, created_at)
      VALUES (@id, @numero, @tipo, @categoria, @unidad, @bloque_horas, @precio, @estado, @created_at)
    `).run(room);
  } catch (e) {
    if (String(e.message).includes('UNIQUE')) return res.status(409).json({ error: `Ya existe una habitación con el número ${room.numero}.` });
    throw e;
  }
  realtime.broadcast('rooms:changed', { reason: 'create' });
  res.status(201).json({ room });
}

/** PATCH /api/rooms/:id — editar tipo/categoría/precio o forzar un estado (libre/limpieza/mantenimiento). */
function update(req, res) {
  const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(req.params.id);
  if (!room) return res.status(404).json({ error: 'Habitación no encontrada.' });
  if (room.estado === 'ocupado' && req.body.estado && req.body.estado !== 'ocupado') {
    return res.status(409).json({ error: 'No puedes cambiar el estado de una habitación ocupada: usa check-out primero.' });
  }

  const tipo = req.body.tipo ?? room.tipo;
  const categoria = req.body.categoria ?? room.categoria;
  const precio = req.body.precio != null ? Number(req.body.precio) : room.precio;
  const estado = req.body.estado ?? room.estado;

  db.prepare('UPDATE rooms SET tipo = ?, categoria = ?, precio = ?, estado = ? WHERE id = ?').run(tipo, categoria, precio, estado, room.id);
  realtime.broadcast('rooms:changed', { reason: 'update' });
  res.json({ room: { ...room, tipo, categoria, precio, estado } });
}

/** DELETE /api/rooms/:id — eliminar habitación (solo admin, si no está ocupada). */
function remove(req, res) {
  const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(req.params.id);
  if (!room) return res.status(404).json({ error: 'Habitación no encontrada.' });
  if (room.estado === 'ocupado') return res.status(409).json({ error: 'No puedes eliminar una habitación ocupada.' });

  db.prepare('DELETE FROM rooms WHERE id = ?').run(room.id);
  realtime.broadcast('rooms:changed', { reason: 'delete' });
  res.json({ ok: true });
}

/**
 * POST /api/rooms/:id/checkin
 * Registra al huésped (con sus datos exigidos por la normativa peruana
 * de hospedaje) y abre una "estancia" para la habitación.
 *
 * Si el documento ya existe en la base de datos (un huésped que ya se
 * hospedó antes), reutilizamos su ficha en vez de duplicarla.
 */
function checkin(req, res) {
  const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(req.params.id);
  if (!room) return res.status(404).json({ error: 'Habitación no encontrada.' });
  if (room.estado !== 'libre') return res.status(409).json({ error: 'Esta habitación no está libre en este momento.' });

  const {
    tipo_documento, numero_documento, nombres, apellidos,
    nacionalidad, procedencia, destino, telefono, fecha_nacimiento,
    noches, motivo_viaje,
  } = req.body;

  let guest = db.prepare(
    'SELECT * FROM guests WHERE tipo_documento = ? AND numero_documento = ?'
  ).get(tipo_documento, numero_documento);

  if (!guest) {
    guest = {
      id: newId(), tipo_documento, numero_documento, nombres, apellidos,
      nacionalidad, procedencia: procedencia || null, destino: destino || null,
      telefono: telefono || null, fecha_nacimiento: fecha_nacimiento || null,
      created_at: nowISO(),
    };
    db.prepare(`
      INSERT INTO guests (id, tipo_documento, numero_documento, nombres, apellidos, nacionalidad, procedencia, destino, telefono, fecha_nacimiento, created_at)
      VALUES (@id, @tipo_documento, @numero_documento, @nombres, @apellidos, @nacionalidad, @procedencia, @destino, @telefono, @fecha_nacimiento, @created_at)
    `).run(guest);
  } else {
    // El huésped vuelve a hospedarse: refrescamos datos de contacto/procedencia
    // por si cambiaron, sin perder su historial anterior.
    db.prepare(`
      UPDATE guests SET nombres=?, apellidos=?, nacionalidad=?, procedencia=?, destino=?, telefono=?
      WHERE id = ?
    `).run(nombres, apellidos, nacionalidad, procedencia || null, destino || null, telefono || null, guest.id);
  }

  const stay = {
    id: newId(), room_id: room.id, guest_id: guest.id,
    checkin_date: today(), checkout_date: null,
    nights: Math.max(1, parseInt(noches, 10) || 1),
    price_per_night: room.precio, total: null,
    motivo_viaje: motivo_viaje || null,
    estado: 'activa', created_by: req.user.sub, created_at: nowISO(),
  };
  db.prepare(`
    INSERT INTO stays (id, room_id, guest_id, checkin_date, checkout_date, nights, price_per_night, total, motivo_viaje, estado, created_by, created_at)
    VALUES (@id, @room_id, @guest_id, @checkin_date, @checkout_date, @nights, @price_per_night, @total, @motivo_viaje, @estado, @created_by, @created_at)
  `).run(stay);

  db.prepare('UPDATE rooms SET estado = ? WHERE id = ?').run('ocupado', room.id);

  realtime.broadcast('rooms:changed', { reason: 'checkin', room_id: room.id });
  // Respaldo automático: cada huésped que hace check-in queda también
  // como una fila en la hoja de cálculo de Google (si está configurada).
  // No se espera (no "await"): si Google está lento, el check-in no se demora.
  sheets.appendRow('Huéspedes', [
    guest.tipo_documento, guest.numero_documento, guest.nombres, guest.apellidos,
    guest.nacionalidad, guest.procedencia || '', guest.destino || '', guest.telefono || '',
    room.numero, stay.checkin_date, stay.nights, stay.price_per_night, guest.created_at,
  ]);
  res.status(201).json({ stay, guest });
}

/**
 * POST /api/rooms/:id/checkout
 * Cierra la estancia activa, calcula el total, lo registra como
 * ingreso en finanzas y deja la habitación "en limpieza".
 */
function checkout(req, res) {
  const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(req.params.id);
  if (!room) return res.status(404).json({ error: 'Habitación no encontrada.' });
  if (room.estado !== 'ocupado') return res.status(409).json({ error: 'Esta habitación no tiene una estancia activa.' });

  const stay = db.prepare(`SELECT * FROM stays WHERE room_id = ? AND estado = 'activa'`).get(room.id);
  if (!stay) return res.status(409).json({ error: 'No se encontró la estancia activa de esta habitación.' });

  const { metodo_pago } = req.body;
  const nightsFinales = req.body.noches_finales ? Math.max(1, parseInt(req.body.noches_finales, 10)) : stay.nights;
  const total = nightsFinales * stay.price_per_night;

  db.prepare(`UPDATE stays SET checkout_date = ?, nights = ?, total = ?, estado = 'finalizada' WHERE id = ?`)
    .run(today(), nightsFinales, total, stay.id);

  const guest = db.prepare('SELECT * FROM guests WHERE id = ?').get(stay.guest_id);
  const finance = {
    id: newId(), fecha: today(),
    concepto: `Pago habitación ${room.numero} — ${guest.nombres} ${guest.apellidos} (${nightsFinales} noche(s))`,
    tipo: 'ingreso', monto: total, metodo: metodo_pago,
    referencia_estancia_id: stay.id, created_by: req.user.sub, created_at: nowISO(),
  };
  db.prepare(`
    INSERT INTO finance (id, fecha, concepto, tipo, monto, metodo, referencia_estancia_id, created_by, created_at)
    VALUES (@id, @fecha, @concepto, @tipo, @monto, @metodo, @referencia_estancia_id, @created_by, @created_at)
  `).run(finance);

  db.prepare('UPDATE rooms SET estado = ? WHERE id = ?').run('limpieza', room.id);

  realtime.broadcast('rooms:changed', { reason: 'checkout', room_id: room.id });
  realtime.broadcast('finance:changed', { reason: 'checkout' });
  sheets.appendRow('Finanzas', [finance.fecha, finance.concepto, finance.tipo, finance.monto, finance.metodo, finance.created_at]);
  res.json({ total, finance });
}

module.exports = { list, create, update, remove, checkin, checkout };
