const db = require('../db');
const { newId } = require('../utils/ids');
const realtime = require('../realtime');
const sheets = require('../backup/googleSheets');

const nowISO = () => new Date().toISOString();
const today = () => new Date().toISOString().slice(0, 10);

/** GET /api/finance — historial de movimientos, más recientes primero. */
function list(req, res) {
  const rows = db.prepare('SELECT * FROM finance ORDER BY created_at DESC LIMIT 200').all();
  res.json({ finance: rows });
}

/**
 * GET /api/finance/summary
 * Todos los números que necesita el dashboard, calculados en el
 * servidor (nunca confiamos en que el navegador sume bien: los
 * totales de dinero SIEMPRE se calculan del lado del servidor).
 */
function summary(req, res) {
  const totales = db.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN tipo='ingreso' THEN monto END), 0) AS ingresos,
      COALESCE(SUM(CASE WHEN tipo='egreso' THEN monto END), 0) AS egresos
    FROM finance
  `).get();

  const hoy = today();
  const hoyTotales = db.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN tipo='ingreso' THEN monto END), 0) AS ingresos,
      COALESCE(SUM(CASE WHEN tipo='egreso' THEN monto END), 0) AS egresos
    FROM finance WHERE fecha = ?
  `).get(hoy);

  const last7 = db.prepare(`
    SELECT fecha,
      COALESCE(SUM(CASE WHEN tipo='ingreso' THEN monto END), 0) AS ingresos,
      COALESCE(SUM(CASE WHEN tipo='egreso' THEN monto END), 0) AS egresos
    FROM finance
    WHERE fecha >= date('now', '-6 days')
    GROUP BY fecha
    ORDER BY fecha ASC
  `).all();

  // Gráfica "realista": últimas 8 semanas (etiqueta = lunes de cada semana,
  // calculado con SQLite: weekday(0=domingo) -> restamos hasta el lunes).
  const last8Weeks = db.prepare(`
    SELECT date(fecha, '-' || ((CAST(strftime('%w', fecha) AS INTEGER) + 6) % 7) || ' days') AS semana,
      COALESCE(SUM(CASE WHEN tipo='ingreso' THEN monto END), 0) AS ingresos,
      COALESCE(SUM(CASE WHEN tipo='egreso' THEN monto END), 0) AS egresos
    FROM finance
    WHERE fecha >= date('now', '-55 days')
    GROUP BY semana
    ORDER BY semana ASC
  `).all();

  // Últimos 6 meses (etiqueta = YYYY-MM).
  const last6Months = db.prepare(`
    SELECT strftime('%Y-%m', fecha) AS mes,
      COALESCE(SUM(CASE WHEN tipo='ingreso' THEN monto END), 0) AS ingresos,
      COALESCE(SUM(CASE WHEN tipo='egreso' THEN monto END), 0) AS egresos
    FROM finance
    WHERE fecha >= date('now', '-5 months', 'start of month')
    GROUP BY mes
    ORDER BY mes ASC
  `).all();

  res.json({
    ingresosTotales: totales.ingresos,
    egresosTotales: totales.egresos,
    balance: totales.ingresos - totales.egresos,
    hoy: hoyTotales,
    last7,
    last8Weeks,
    last6Months,
  });
}

/** POST /api/finance — movimiento manual (solo admin). */
function create(req, res) {
  const { concepto, tipo, monto, metodo } = req.body;
  const row = {
    id: newId(), fecha: today(), concepto, tipo, monto: Number(monto),
    metodo, referencia_estancia_id: null, created_by: req.user.sub, created_at: nowISO(),
  };
  db.prepare(`
    INSERT INTO finance (id, fecha, concepto, tipo, monto, metodo, referencia_estancia_id, created_by, created_at)
    VALUES (@id, @fecha, @concepto, @tipo, @monto, @metodo, @referencia_estancia_id, @created_by, @created_at)
  `).run(row);

  realtime.broadcast('finance:changed', { reason: 'manual' });
  sheets.appendRow('Finanzas', [row.fecha, row.concepto, row.tipo, row.monto, row.metodo, row.created_at]);
  res.status(201).json({ finance: row });
}

module.exports = { list, summary, create };
