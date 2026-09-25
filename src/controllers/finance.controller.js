const db = require('../db');
const { newId } = require('../utils/ids');
const realtime = require('../realtime');
const sheets = require('../backup/googleSheets');

const nowISO = () => new Date().toISOString();
const { hoy: today } = require('../utils/fechas');
const { METODOS, r2, normalizarPagos, metodoResumen, registrarPagos, pagosPorMovimiento } = require('../utils/pagos');
const { emitir, codigo } = require('../utils/comprobantes');

/**
 * GET /api/finance — historial de movimientos, más recientes primero,
 * con el detalle de cómo se pagó cada uno y su comprobante (si tiene).
 */
function list(req, res) {
  const rows = db.prepare(`
    SELECT f.*, u.nombre AS registrado_por
    FROM finance f LEFT JOIN users u ON u.id = f.created_by
    ORDER BY f.created_at DESC LIMIT 300
  `).all();
  const pagos = pagosPorMovimiento(db, rows.map(r => r.id));
  const comps = {};
  if (rows.length) {
    const marcas = rows.map(() => '?').join(',');
    for (const c of db.prepare(`SELECT id, tipo, serie, numero, finance_id FROM comprobantes WHERE estado = 'emitido' AND finance_id IN (${marcas})`).all(...rows.map(r => r.id))) {
      comps[c.finance_id] = { id: c.id, tipo: c.tipo, codigo: codigo(c) };
    }
  }
  res.json({
    finance: rows.map(r => ({
      ...r,
      pagos: pagos[r.id] || [{ metodo: r.metodo, monto: r.monto }],
      comprobante: comps[r.id] || null,
    })),
  });
}

/**
 * GET /api/finance/summary
 * Todos los números que necesita el dashboard, calculados en el
 * servidor (nunca confiamos en que el navegador sume bien: los
 * totales de dinero SIEMPRE se calculan del lado del servidor).
 */
function summary(req, res) {
  // Los totales acumulados arrancan en cero tras cada CIERRE GENERAL
  // (la liquidación que pide la dueña). El historial completo sigue en la
  // base de datos y en el Excel; solo cambia desde cuándo se suma aquí.
  const general = db.prepare("SELECT hasta, numero FROM cierres_caja WHERE tipo = 'general' ORDER BY numero DESC LIMIT 1").get();
  const totales = db.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN tipo='ingreso' THEN monto END), 0) AS ingresos,
      COALESCE(SUM(CASE WHEN tipo='egreso' THEN monto END), 0) AS egresos
    FROM finance WHERE created_at > ?
  `).get(general ? general.hasta : '1970-01-01T00:00:00.000Z');

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
    WHERE fecha >= date(@hoy, '-6 days')
    GROUP BY fecha
    ORDER BY fecha ASC
  `).all({ hoy });

  // Gráfica "realista": últimas 8 semanas (etiqueta = lunes de cada semana,
  // calculado con SQLite: weekday(0=domingo) -> restamos hasta el lunes).
  const last8Weeks = db.prepare(`
    SELECT date(fecha, '-' || ((CAST(strftime('%w', fecha) AS INTEGER) + 6) % 7) || ' days') AS semana,
      COALESCE(SUM(CASE WHEN tipo='ingreso' THEN monto END), 0) AS ingresos,
      COALESCE(SUM(CASE WHEN tipo='egreso' THEN monto END), 0) AS egresos
    FROM finance
    WHERE fecha >= date(@hoy, '-55 days')
    GROUP BY semana
    ORDER BY semana ASC
  `).all({ hoy });

  // Últimos 6 meses (etiqueta = YYYY-MM).
  const last6Months = db.prepare(`
    SELECT strftime('%Y-%m', fecha) AS mes,
      COALESCE(SUM(CASE WHEN tipo='ingreso' THEN monto END), 0) AS ingresos,
      COALESCE(SUM(CASE WHEN tipo='egreso' THEN monto END), 0) AS egresos
    FROM finance
    WHERE fecha >= date(@hoy, '-5 months', 'start of month')
    GROUP BY mes
    ORDER BY mes ASC
  `).all({ hoy });

  // Hoy, desglosado por método de pago (efectivo, Yape, Plin, tarjeta, transferencia).
  const porMetodo = Object.fromEntries(METODOS.map(m => [m, { ingresos: 0, egresos: 0 }]));
  for (const r of db.prepare(`
    SELECT p.metodo, f.tipo, SUM(p.monto) AS total
    FROM pagos p JOIN finance f ON f.id = p.finance_id
    WHERE f.fecha = ? GROUP BY p.metodo, f.tipo
  `).all(hoy)) {
    const m = porMetodo[r.metodo] || (porMetodo[r.metodo] = { ingresos: 0, egresos: 0 });
    m[r.tipo === 'ingreso' ? 'ingresos' : 'egresos'] = r2(r.total);
  }

  res.json({
    hoyPorMetodo: porMetodo,
    desdeCierreGeneral: general ? { hasta: general.hasta, numero: general.numero } : null,
    ingresosTotales: totales.ingresos,
    egresosTotales: totales.egresos,
    balance: totales.ingresos - totales.egresos,
    hoy: hoyTotales,
    last7,
    last8Weeks,
    last6Months,
  });
}

/**
 * POST /api/finance — movimiento manual.
 *  - Egresos (gastos): administrador y recepción (p. ej. compra de insumos con dinero de caja).
 *  - Ingresos manuales: solo administrador. Pueden llevar boleta/factura.
 */
function create(req, res) {
  const { concepto, tipo } = req.body;
  if (tipo === 'ingreso' && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Solo el administrador registra ingresos manuales.' });
  }
  const monto = r2(req.body.monto);

  const { row, pagos, comprobante } = db.transaction(() => {
    const pagos = normalizarPagos(req.body, monto);
    const row = {
      id: newId(), fecha: today(), concepto: String(concepto).trim(), tipo, monto,
      metodo: metodoResumen(pagos), referencia_estancia_id: null, created_by: req.user.sub, created_at: nowISO(),
    };
    db.prepare(`
      INSERT INTO finance (id, fecha, concepto, tipo, monto, metodo, referencia_estancia_id, created_by, created_at)
      VALUES (@id, @fecha, @concepto, @tipo, @monto, @metodo, @referencia_estancia_id, @created_by, @created_at)
    `).run(row);
    registrarPagos(db, row.id, pagos, row.created_at);

    let comprobante = null;
    const comp = req.body.comprobante;
    if (tipo === 'ingreso' && comp && comp.tipo && comp.tipo !== 'ninguno') {
      comprobante = emitir(db, {
        tipo: comp.tipo, cliente: comp,
        items: [{ descripcion: row.concepto, unidad: 'SERV', cantidad: 1, precio_unitario: monto, importe: monto }],
        total: monto, pagos, recibido: req.body.recibido, financeId: row.id, user: req.user,
      });
    }
    return { row, pagos, comprobante };
  })();

  realtime.broadcast('finance:changed', { reason: 'manual' });
  sheets.appendRow('Finanzas', [row.fecha, row.concepto, row.tipo, row.monto, pagos.map(p => `${p.metodo} ${p.monto.toFixed(2)}`).join(' + '), row.created_at]);
  res.status(201).json({ finance: { ...row, pagos }, comprobante });
}

module.exports = { list, summary, create };
