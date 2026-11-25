/**
 * controllers/caja.controller.js
 * ---------------------------------------------------------------
 * CIERRE DE CAJA. Cada cierre cubre todo lo registrado desde el cierre
 * anterior hasta este momento:
 *   - Ingresos y egresos desglosados por método de pago (Efectivo,
 *     Yape, Plin, Tarjeta, Transferencia), incluidos los pagos mixtos.
 *   - Neto = ingresos − egresos (total y por método).
 *   - Efectivo esperado en caja = fondo inicial + efectivo neto; si el
 *     cajero cuenta el dinero, se calcula el sobrante o faltante.
 *   - Resumen por concepto (hospedaje, ventas, otros, gastos) y de los
 *     comprobantes emitidos/anulados en el periodo.
 *
 * Hay dos tipos de cierre:
 *   - TURNO: lo hace recepción al terminar su turno. Cubre desde el
 *     último cierre (de cualquier tipo) hasta ahora.
 *   - GENERAL: la liquidación que pide la dueña ("saquemos cuentas hasta
 *     hoy"). Solo administrador. Cubre desde el último cierre GENERAL,
 *     incluye todos los turnos intermedios y deja en CERO los totales de
 *     Finanzas y la caja actual.
 * El resultado queda congelado (JSON) para reimprimir el ticket igual.
 */
const db = require('../db');
const { newId } = require('../utils/ids');
const realtime = require('../realtime');
const { METODOS, r2, pagosPorMovimiento } = require('../utils/pagos');
const { getAjustes } = require('../utils/comprobantes');

const INICIO = '1970-01-01T00:00:00.000Z';

/** Último cierre de cualquier tipo (marca dónde empieza el turno actual). */
function ultimoCierre() {
  return db.prepare('SELECT * FROM cierres_caja ORDER BY numero DESC LIMIT 1').get() || null;
}
/** Último cierre GENERAL (marca desde cuándo se cuentan los totales de Finanzas). */
function ultimoGeneral() {
  return db.prepare("SELECT * FROM cierres_caja WHERE tipo = 'general' ORDER BY numero DESC LIMIT 1").get() || null;
}
/** Desde dónde se cuenta un cierre de ese tipo. */
function inicioPeriodo(tipo) {
  const ult = tipo === 'general' ? ultimoGeneral() : ultimoCierre();
  return { ult, desde: ult ? ult.hasta : INICIO };
}
const contarTurnos = desde => db.prepare("SELECT COUNT(*) AS n FROM cierres_caja WHERE tipo = 'turno' AND hasta > ?").get(desde).n;

function calcular(desde, hasta, fondoInicial, efectivoContado) {
  const movs = db.prepare(`
    SELECT f.id, f.fecha, f.concepto, f.tipo, f.monto, f.metodo, f.referencia_estancia_id, f.created_at, u.nombre AS usuario
    FROM finance f LEFT JOIN users u ON u.id = f.created_by
    WHERE f.created_at > ? AND f.created_at <= ?
    ORDER BY f.created_at ASC
  `).all(desde, hasta);
  const pagos = pagosPorMovimiento(db, movs.map(m => m.id));

  const porMetodo = Object.fromEntries(METODOS.map(m => [m, { ingresos: 0, egresos: 0, neto: 0 }]));
  const categorias = { hospedaje: 0, ventas: 0, otros_ingresos: 0, egresos: 0 };
  let ingresos = 0;
  let egresos = 0;

  const movimientos = movs.map(m => {
    const ps = pagos[m.id] || [{ metodo: m.metodo, monto: m.monto }];
    for (const p of ps) {
      const acc = porMetodo[p.metodo] || (porMetodo[p.metodo] = { ingresos: 0, egresos: 0, neto: 0 });
      if (m.tipo === 'ingreso') acc.ingresos += p.monto; else acc.egresos += p.monto;
    }
    if (m.tipo === 'ingreso') {
      ingresos += m.monto;
      if (m.referencia_estancia_id) categorias.hospedaje += m.monto;
      else if (m.concepto.startsWith('Venta:')) categorias.ventas += m.monto;
      else categorias.otros_ingresos += m.monto;
    } else {
      egresos += m.monto;
      categorias.egresos += m.monto;
    }
    return {
      hora: m.created_at, concepto: m.concepto, tipo: m.tipo, monto: r2(m.monto),
      usuario: m.usuario || '—', pagos: ps,
    };
  });

  for (const k of Object.keys(porMetodo)) {
    const a = porMetodo[k];
    a.ingresos = r2(a.ingresos); a.egresos = r2(a.egresos); a.neto = r2(a.ingresos - a.egresos);
  }
  for (const k of Object.keys(categorias)) categorias[k] = r2(categorias[k]);

  const comps = db.prepare(`
    SELECT tipo, estado, COUNT(*) AS cantidad, COALESCE(SUM(total), 0) AS total
    FROM comprobantes WHERE created_at > ? AND created_at <= ?
    GROUP BY tipo, estado
  `).all(desde, hasta);
  const comprobantes = { boletas: 0, facturas: 0, total_emitido: 0, anulados: 0 };
  for (const c of comps) {
    if (c.estado === 'anulado') { comprobantes.anulados += c.cantidad; continue; }
    if (c.tipo === 'boleta') comprobantes.boletas += c.cantidad; else comprobantes.facturas += c.cantidad;
    comprobantes.total_emitido = r2(comprobantes.total_emitido + c.total);
  }

  const fondo = r2(fondoInicial || 0);
  const efectivoEsperado = r2(fondo + (porMetodo.Efectivo ? porMetodo.Efectivo.neto : 0));
  const contado = efectivoContado === null || efectivoContado === undefined || efectivoContado === '' ? null : r2(efectivoContado);

  return {
    desde, hasta,
    fondo_inicial: fondo,
    efectivo_esperado: efectivoEsperado,
    efectivo_contado: contado,
    diferencia: contado === null ? null : r2(contado - efectivoEsperado),
    por_metodo: porMetodo,
    totales: { ingresos: r2(ingresos), egresos: r2(egresos), neto: r2(ingresos - egresos), movimientos: movs.length },
    categorias,
    comprobantes,
    movimientos,
  };
}

function parseCierre(row) {
  if (!row) return null;
  return { ...row, resumen: JSON.parse(row.resumen) };
}

/**
 * GET /api/caja/actual?tipo=turno|general&fondo=0
 * Cómo va la caja (sin cerrarla): desde el último cierre (turno) o desde
 * el último cierre general (general).
 */
function actual(req, res) {
  const tipo = req.query.tipo === 'general' ? 'general' : 'turno';
  const { ult, desde } = inicioPeriodo(tipo);
  const fondo = req.query.fondo !== undefined ? Number(req.query.fondo) || 0 : (ult ? ult.fondo_inicial : 0);
  const resumen = calcular(desde, new Date().toISOString(), fondo, null);
  resumen.turnos_incluidos = contarTurnos(desde);
  res.json({
    tipo,
    resumen,
    ultimo: ult ? { id: ult.id, numero: ult.numero, tipo: ult.tipo, hasta: ult.hasta, created_by_nombre: ult.created_by_nombre } : null,
    fondo_sugerido: ult ? ult.fondo_inicial : 0,
  });
}

/** POST /api/caja/cerrar — { tipo: 'turno'|'general', fondo_inicial, efectivo_contado, observaciones } */
function cerrar(req, res) {
  const tipo = req.body.tipo === 'general' ? 'general' : 'turno';
  if (tipo === 'general' && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Solo el administrador puede hacer el cierre general.' });
  }
  const cierre = db.transaction(() => {
    const { desde } = inicioPeriodo(tipo);
    const ultCualquiera = ultimoCierre();
    const hasta = new Date().toISOString();
    const resumen = calcular(desde, hasta, req.body.fondo_inicial, req.body.efectivo_contado);
    resumen.tipo = tipo;
    resumen.turnos_incluidos = contarTurnos(desde);
    resumen.emisor = (({ nombre_comercial, razon_social, ruc, direccion, telefono }) =>
      ({ nombre_comercial, razon_social, ruc, direccion, telefono }))(getAjustes(db));
    const row = {
      id: newId(),
      numero: (ultCualquiera ? ultCualquiera.numero : 0) + 1,
      tipo,
      desde, hasta,
      fondo_inicial: resumen.fondo_inicial,
      efectivo_contado: resumen.efectivo_contado,
      resumen: JSON.stringify(resumen),
      observaciones: String(req.body.observaciones || '').trim().slice(0, 300) || null,
      created_by: req.user.sub,
      created_by_nombre: req.user.nombre,
      created_at: hasta,
    };
    db.prepare(`
      INSERT INTO cierres_caja (id, numero, tipo, desde, hasta, fondo_inicial, efectivo_contado, resumen, observaciones, created_by, created_by_nombre, created_at)
      VALUES (@id, @numero, @tipo, @desde, @hasta, @fondo_inicial, @efectivo_contado, @resumen, @observaciones, @created_by, @created_by_nombre, @created_at)
    `).run(row);
    return parseCierre(row);
  })();
  realtime.broadcast('caja:changed', { reason: 'cierre' });
  if (tipo === 'general') realtime.broadcast('finance:changed', { reason: 'cierre-general' });
  res.status(201).json({ cierre });
}

/** GET /api/caja/cierres — historial (sin el detalle de movimientos). */
function list(req, res) {
  const rows = db.prepare('SELECT * FROM cierres_caja ORDER BY numero DESC LIMIT 200').all();
  res.json({
    cierres: rows.map(r => {
      const s = JSON.parse(r.resumen);
      return {
        id: r.id, numero: r.numero, tipo: r.tipo || 'turno', desde: r.desde, hasta: r.hasta, created_by_nombre: r.created_by_nombre,
        fondo_inicial: r.fondo_inicial, efectivo_contado: r.efectivo_contado, observaciones: r.observaciones,
        totales: s.totales, por_metodo: s.por_metodo, diferencia: s.diferencia, efectivo_esperado: s.efectivo_esperado,
      };
    }),
  });
}

/** GET /api/caja/cierres/:id — detalle completo para el ticket. */
function get(req, res) {
  const c = parseCierre(db.prepare('SELECT * FROM cierres_caja WHERE id = ?').get(req.params.id));
  if (!c) return res.status(404).json({ error: 'Cierre no encontrado.' });
  res.json({ cierre: c });
}

/**
 * GET /api/caja/reporte[?cierre=<id>] — reporte simple de UN empleado:
 * qué habitaciones dio (check-ins que hizo) y qué productos vendió.
 *   - Sin `cierre`: el turno actual del empleado que lo pide (hasta ahora).
 *   - Con `cierre`: el turno ya cerrado (cubre desde/hasta de ese cierre y
 *     es del empleado que lo cerró), con la hora a la que se cerró.
 */
function reporte(req, res) {
  let desde, hasta, userId, nombre, cerrado = false;
  if (req.query.cierre) {
    const c = db.prepare('SELECT * FROM cierres_caja WHERE id = ?').get(req.query.cierre);
    if (!c) return res.status(404).json({ error: 'Cierre no encontrado.' });
    ({ desde, hasta } = c); userId = c.created_by; nombre = c.created_by_nombre; cerrado = true;
  } else {
    desde = inicioPeriodo('turno').desde; hasta = new Date().toISOString();
    userId = req.user.sub; nombre = req.user.nombre;
  }
  const habitaciones = db.prepare(`
    SELECT r.numero FROM stays s JOIN rooms r ON r.id = s.room_id
    WHERE s.created_by = ? AND s.created_at > ? AND s.created_at <= ?
    ORDER BY s.created_at ASC
  `).all(userId, desde, hasta).map(x => x.numero);
  const productos = db.prepare(`
    SELECT i.nombre, SUM(m.cantidad) AS cantidad
    FROM inventory_movements m JOIN inventory i ON i.id = m.producto_id
    WHERE m.tipo = 'venta' AND m.created_by = ? AND m.created_at > ? AND m.created_at <= ?
    GROUP BY i.id ORDER BY i.nombre
  `).all(userId, desde, hasta);
  res.json({ empleado: nombre, desde, hasta, cerrado, habitaciones, productos });
}

module.exports = { actual, cerrar, list, get, calcular, reporte };
