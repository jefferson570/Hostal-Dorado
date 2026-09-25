const db = require('../db');

/**
 * GET /api/guests?buscar=texto
 * Búsqueda por número de documento, nombres o apellidos — lo que un
 * recepcionista realmente usa: "¿este huésped ya se hospedó antes?"
 */
function list(req, res) {
  const buscar = (req.query.buscar || '').trim();
  let rows;
  if (buscar) {
    const like = `%${buscar}%`;
    rows = db.prepare(`
      SELECT * FROM guests
      WHERE numero_documento LIKE ? OR nombres LIKE ? OR apellidos LIKE ?
      ORDER BY created_at DESC LIMIT 50
    `).all(like, like, like);
  } else {
    rows = db.prepare('SELECT * FROM guests ORDER BY created_at DESC LIMIT 50').all();
  }
  res.json({ guests: rows });
}

/** GET /api/guests/:id/history — ficha completa: datos + historial de estancias. */
function history(req, res) {
  const guest = db.prepare('SELECT * FROM guests WHERE id = ?').get(req.params.id);
  if (!guest) return res.status(404).json({ error: 'Huésped no encontrado.' });

  const stays = db.prepare(`
    SELECT s.*, r.numero AS room_numero
    FROM stays s JOIN rooms r ON r.id = s.room_id
    WHERE s.guest_id = ?
    ORDER BY s.checkin_date DESC
  `).all(guest.id);

  res.json({ guest, stays });
}

module.exports = { list, history };
