/**
 * utils/pagos.js
 * ---------------------------------------------------------------
 * Métodos de pago y pagos mixtos. Todo cobro se guarda como una o
 * varias filas en la tabla `pagos` (p. ej. S/ 60 en Efectivo + S/ 60
 * por Yape). El cierre de caja suma estas filas por método.
 */
const { newId } = require('./ids');

const METODOS = ['Efectivo', 'Yape', 'Plin', 'Tarjeta', 'Transferencia'];
const r2 = n => Math.round(Number(n) * 100) / 100;

function error400(msg) {
  const e = new Error(msg);
  e.status = 400;
  return e;
}

/**
 * Convierte lo que envía el panel en una lista validada de pagos.
 * Acepta `pagos: [{metodo, monto}]` (pago mixto) o un solo método en
 * `metodo_pago` / `metodo` (paga todo con ese método).
 * La suma de los pagos debe ser EXACTAMENTE el total (al céntimo).
 */
function normalizarPagos(body, total) {
  const lista = Array.isArray(body.pagos) && body.pagos.length
    ? body.pagos
    : [{ metodo: body.metodo_pago || body.metodo || 'Efectivo', monto: total }];

  const acumulado = new Map();
  for (const p of lista) {
    let metodo = String((p && p.metodo) || '').trim();
    if (metodo === 'Yape/Plin') metodo = 'Yape'; // compatibilidad con versiones anteriores
    if (!METODOS.includes(metodo)) throw error400(`Método de pago inválido: ${metodo || '(vacío)'}.`);
    const monto = r2(p.monto);
    if (!Number.isFinite(monto) || monto < 0) throw error400('Los montos de pago no pueden ser negativos.');
    if (monto === 0) continue;
    acumulado.set(metodo, r2((acumulado.get(metodo) || 0) + monto));
  }
  const pagos = [...acumulado].map(([metodo, monto]) => ({ metodo, monto }));
  if (!pagos.length) throw error400('Indica cómo se realizó el pago.');

  const suma = r2(pagos.reduce((a, p) => a + p.monto, 0));
  if (Math.abs(suma - r2(total)) > 0.009) {
    throw error400(`Los pagos suman S/ ${suma.toFixed(2)} pero el total es S/ ${r2(total).toFixed(2)}.`);
  }
  return pagos;
}

/** Nombre del método para mostrar en listas: el único método, o "Mixto". */
const metodoResumen = pagos => (pagos.length === 1 ? pagos[0].metodo : 'Mixto');

function registrarPagos(db, financeId, pagos, createdAt) {
  const ins = db.prepare('INSERT INTO pagos (id, finance_id, metodo, monto, created_at) VALUES (?, ?, ?, ?, ?)');
  for (const p of pagos) ins.run(newId(), financeId, p.metodo, p.monto, createdAt);
}

/** Pagos de varios movimientos a la vez: { finance_id: [{metodo, monto}] }. */
function pagosPorMovimiento(db, financeIds) {
  const mapa = {};
  if (!financeIds.length) return mapa;
  const marcas = financeIds.map(() => '?').join(',');
  for (const p of db.prepare(`SELECT finance_id, metodo, monto FROM pagos WHERE finance_id IN (${marcas}) ORDER BY rowid`).all(...financeIds)) {
    (mapa[p.finance_id] || (mapa[p.finance_id] = [])).push({ metodo: p.metodo, monto: p.monto });
  }
  return mapa;
}

module.exports = { METODOS, r2, error400, normalizarPagos, metodoResumen, registrarPagos, pagosPorMovimiento };
