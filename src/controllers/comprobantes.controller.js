/**
 * controllers/comprobantes.controller.js
 * ---------------------------------------------------------------
 * Boletas y facturas: listado, detalle (para imprimir), emisión a
 * partir de un ingreso ya registrado y anulación (solo administrador).
 */
const db = require('../db');
const realtime = require('../realtime');
const { emitir, parse } = require('../utils/comprobantes');
const { pagosPorMovimiento } = require('../utils/pagos');

/** GET /api/comprobantes?tipo=&desde=AAAA-MM-DD&hasta=AAAA-MM-DD&q= */
function list(req, res) {
  const where = [];
  const params = [];
  if (['boleta', 'factura'].includes(req.query.tipo)) { where.push('tipo = ?'); params.push(req.query.tipo); }
  if (/^\d{4}-\d{2}-\d{2}$/.test(req.query.desde || '')) { where.push('created_at >= ?'); params.push(new Date(req.query.desde + 'T00:00:00').toISOString()); }
  if (/^\d{4}-\d{2}-\d{2}$/.test(req.query.hasta || '')) { where.push('created_at < ?'); params.push(new Date(new Date(req.query.hasta + 'T00:00:00').getTime() + 86400000).toISOString()); }
  const q = String(req.query.q || '').trim();
  if (q) {
    where.push('(cliente_nombre LIKE ? OR cliente_doc LIKE ? OR (serie || \'-\' || printf(\'%08d\', numero)) LIKE ?)');
    params.push(`%${q}%`, `%${q}%`, `%${q.toUpperCase()}%`);
  }
  const rows = db.prepare(`
    SELECT * FROM comprobantes ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY created_at DESC LIMIT 300
  `).all(...params);
  res.json({ comprobantes: rows.map(parse) });
}

/** GET /api/comprobantes/:id — todo lo necesario para imprimirlo. */
function get(req, res) {
  const c = parse(db.prepare('SELECT * FROM comprobantes WHERE id = ?').get(req.params.id));
  if (!c) return res.status(404).json({ error: 'Comprobante no encontrado.' });
  res.json({ comprobante: c });
}

/**
 * POST /api/comprobantes — emite boleta/factura para un INGRESO ya
 * registrado que no tenía comprobante (p. ej. el cliente la pidió después).
 */
function createFromMovimiento(req, res) {
  const comprobante = db.transaction(() => {
    const f = db.prepare('SELECT * FROM finance WHERE id = ?').get(req.body.finance_id);
    if (!f) throw Object.assign(new Error('Movimiento no encontrado.'), { status: 404 });
    if (f.tipo !== 'ingreso') throw Object.assign(new Error('Solo se emiten comprobantes para ingresos.'), { status: 400 });
    const ya = db.prepare(`SELECT serie, numero FROM comprobantes WHERE finance_id = ? AND estado = 'emitido'`).get(f.id);
    if (ya) throw Object.assign(new Error(`Este cobro ya tiene el comprobante ${ya.serie}-${String(ya.numero).padStart(8, '0')}.`), { status: 409 });

    const pagos = pagosPorMovimiento(db, [f.id])[f.id] || [{ metodo: f.metodo, monto: f.monto }];
    return emitir(db, {
      tipo: req.body.tipo, cliente: req.body,
      items: [{ descripcion: f.concepto, unidad: 'SERV', cantidad: 1, precio_unitario: f.monto, importe: f.monto }],
      total: f.monto, pagos, recibido: null, financeId: f.id, user: req.user,
    });
  })();
  realtime.broadcast('finance:changed', { reason: 'comprobante' });
  res.status(201).json({ comprobante });
}

/** PATCH /api/comprobantes/:id/anular — solo admin, con motivo. El cobro NO se borra de caja. */
function anular(req, res) {
  const c = db.prepare('SELECT * FROM comprobantes WHERE id = ?').get(req.params.id);
  if (!c) return res.status(404).json({ error: 'Comprobante no encontrado.' });
  if (c.estado === 'anulado') return res.status(409).json({ error: 'El comprobante ya estaba anulado.' });
  const motivo = String(req.body.motivo || '').trim().slice(0, 200);
  db.prepare(`UPDATE comprobantes SET estado = 'anulado', motivo_anulacion = ? WHERE id = ?`)
    .run(`${motivo} (anulado por ${req.user.nombre} el ${new Date().toLocaleString('es-PE')})`, c.id);
  realtime.broadcast('finance:changed', { reason: 'anulacion' });
  res.json({ ok: true });
}

module.exports = { list, get, createFromMovimiento, anular };
