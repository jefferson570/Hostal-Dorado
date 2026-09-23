const db = require('../db');
const { ventana, solapan } = require('../utils/ventana');

/**
 * GET /api/schedule?from=AAAA-MM-DD
 * Cronograma semanal (7 días a partir de `from`) para la pestaña
 * Reservas del panel. Devuelve las estancias (habitaciones ocupadas
 * con su periodo de ocupación, granularidad de días) y las reservas
 * activas (pendientes y confirmadas) como bloques de 12 horas con hora
 * exacta y habitación asignada. Las canceladas no se dibujan: no
 * bloquean nada.
 */
function schedule(req, res) {
  const from = (req.query.from || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from)) {
    return res.status(400).json({ error: 'Indica el inicio de la semana con formato AAAA-MM-DD.' });
  }
  const fromPlus = db.prepare('SELECT date(?, \'+7 days\') AS d').get(from).d;

  const estancias = db.prepare(`
    SELECT
      r.numero, r.tipo,
      g.nombres, g.apellidos,
      s.checkin_date AS inicio,
      COALESCE(s.checkout_date, date(s.checkin_date, '+' || s.nights || ' days')) AS fin,
      s.estado
    FROM stays s
    JOIN rooms r ON r.id = s.room_id
    LEFT JOIN guests g ON g.id = s.guest_id
    WHERE s.checkin_date < @to AND COALESCE(s.checkout_date, date(s.checkin_date, '+' || s.nights || ' days')) > @from
    ORDER BY s.checkin_date ASC
  `).all({ from, to: fromPlus });

  const iniWeek = new Date(from + 'T00:00:00').toISOString();
  const finWeek = new Date(fromPlus + 'T00:00:00').toISOString();
  const rooms = db.prepare('SELECT id, numero FROM rooms').all();
  const roomNum = id => (rooms.find(r => r.id === id) || {}).numero || null;

  const reservas = db.prepare(
    `SELECT id, tipo_habitacion, checkin, hora_ingreso, room_id, nombre, estado
     FROM reservations WHERE estado IN ('pendiente','confirmada')`
  ).all()
    .map(r => ({ ...r, ...ventana(r.checkin, r.hora_ingreso) }))
    .filter(r => solapan(iniWeek, finWeek, r.inicio, r.fin))
    .map(r => ({
      id: r.id,
      tipo_habitacion: r.tipo_habitacion,
      inicio: r.inicio, fin: r.fin,
      hora_ingreso: r.hora_ingreso,
      nombre: r.nombre, estado: r.estado,
      numero: roomNum(r.room_id),
      codigo: r.id.slice(0, 6).toUpperCase(),
    }))
    .sort((a, b) => a.inicio.localeCompare(b.inicio));

  res.json({ from, to: fromPlus, estancias, reservas });
}

module.exports = { schedule };