const db = require('../db');
const { newId } = require('../utils/ids');
const realtime = require('../realtime');
const sheets = require('../backup/googleSheets');

const nowISO = () => new Date().toISOString();
const { hoy: today } = require('../utils/fechas');
const { r2, normalizarPagos, metodoResumen, registrarPagos } = require('../utils/pagos');
const { emitir } = require('../utils/comprobantes');

const findActive = db.prepare('SELECT * FROM inventory WHERE id = ? AND activo = 1');
const insertMovement = db.prepare(`
  INSERT INTO inventory_movements (id, producto_id, tipo, cantidad, motivo, precio_venta, costo_unitario, created_by, created_at)
  VALUES (@id, @producto_id, @tipo, @cantidad, @motivo, @precio_venta, @costo_unitario, @created_by, @created_at)
`);

function movement(producto_id, tipo, cantidad, motivo, userId, extra = {}) {
  insertMovement.run({
    id: newId(), producto_id, tipo, cantidad, motivo,
    precio_venta: null, costo_unitario: null,
    created_by: userId, created_at: nowISO(), ...extra,
  });
}

function list(req, res) {
  const rows = db.prepare('SELECT * FROM inventory WHERE activo = 1 ORDER BY nombre ASC').all();
  res.json({ inventory: rows });
}

/**
 * POST /api/inventory
 * ---------------------------------------------------------------
 * Si ya existe un producto con ese nombre (sin importar mayúsculas/
 * espacios), NO se crea uno duplicado: se le suma el stock indicado
 * al producto existente. Si el producto había sido eliminado del
 * catálogo, se reactiva con los datos nuevos.
 */
function create(req, res) {
  const { nombre, categoria, stock, stock_minimo, precio, costo } = req.body;
  const stockNum = parseInt(stock, 10) || 0;

  const existente = db.prepare(
    `SELECT * FROM inventory WHERE LOWER(TRIM(nombre)) = LOWER(TRIM(?))`
  ).get(nombre);

  if (existente && existente.activo) {
    db.transaction(() => {
      if (stockNum > 0) {
        db.prepare('UPDATE inventory SET stock = stock + ? WHERE id = ?').run(stockNum, existente.id);
        movement(existente.id, 'ajuste', stockNum, 'Reposición desde "Nuevo producto" (ya existía)', req.user.sub);
      }
    })();
    const actualizado = findActive.get(existente.id);
    realtime.broadcast('inventory:changed', { reason: 'restock-existing' });
    return res.status(200).json({
      product: actualizado,
      yaExistia: true,
      mensaje: `"${existente.nombre}" ya existía: se le sumaron ${stockNum} unidad(es) de stock en vez de crear un producto duplicado.`,
    });
  }

  if (existente && !existente.activo) {
    // Reactivamos el producto eliminado: conserva su historial de ventas.
    db.transaction(() => {
      db.prepare(`UPDATE inventory SET activo = 1, nombre = ?, categoria = ?, stock = ?, stock_minimo = ?, precio = ?, costo = ? WHERE id = ?`)
        .run(String(nombre).trim(), categoria || null, stockNum, parseInt(stock_minimo, 10) || 0, Number(precio), Number(costo) || 0, existente.id);
      if (stockNum > 0) movement(existente.id, 'ajuste', stockNum, 'Producto reactivado en el catálogo', req.user.sub);
    })();
    realtime.broadcast('inventory:changed', { reason: 'reactivate' });
    return res.status(201).json({ product: findActive.get(existente.id), yaExistia: false });
  }

  const row = {
    id: newId(), nombre: String(nombre).trim(), categoria: categoria || null,
    stock: stockNum, stock_minimo: parseInt(stock_minimo, 10) || 0,
    precio: Number(precio), costo: Number(costo) || 0, created_at: nowISO(),
  };
  db.prepare(`
    INSERT INTO inventory (id, nombre, categoria, stock, stock_minimo, precio, costo, created_at)
    VALUES (@id, @nombre, @categoria, @stock, @stock_minimo, @precio, @costo, @created_at)
  `).run(row);

  realtime.broadcast('inventory:changed', { reason: 'create' });
  res.status(201).json({ product: row, yaExistia: false });
}

function update(req, res) {
  const product = findActive.get(req.params.id);
  if (!product) return res.status(404).json({ error: 'Producto no encontrado.' });

  const nombre = req.body.nombre ?? product.nombre;
  const categoria = req.body.categoria ?? product.categoria;
  const stock_minimo = req.body.stock_minimo != null ? parseInt(req.body.stock_minimo, 10) : product.stock_minimo;
  const precio = req.body.precio != null ? Number(req.body.precio) : product.precio;
  const costo = req.body.costo != null ? Number(req.body.costo) : product.costo;

  db.prepare('UPDATE inventory SET nombre=?, categoria=?, stock_minimo=?, precio=?, costo=? WHERE id=?')
    .run(nombre, categoria, stock_minimo, precio, costo, product.id);

  realtime.broadcast('inventory:changed', { reason: 'update' });
  res.json({ product: { ...product, nombre, categoria, stock_minimo, precio, costo } });
}

/**
 * DELETE /api/inventory/:id
 * Borrado LÓGICO: el producto desaparece del catálogo pero sus ventas
 * y ajustes pasados siguen en la auditoría y en las ganancias históricas.
 * (Un DELETE físico fallaba con "FOREIGN KEY constraint failed" en
 * cuanto el producto tenía al menos una venta registrada.)
 */
function remove(req, res) {
  const product = findActive.get(req.params.id);
  if (!product) return res.status(404).json({ error: 'Producto no encontrado o ya eliminado.' });
  db.prepare('UPDATE inventory SET activo = 0 WHERE id = ?').run(product.id);
  realtime.broadcast('inventory:changed', { reason: 'delete' });
  res.json({ ok: true });
}

/**
 * POST /api/inventory/:id/sell
 * Descuenta stock, registra el movimiento y suma el ingreso a finanzas
 * dentro de UNA transacción: o se guarda todo, o nada.
 */
function sell(req, res) {
  const cantidad = parseInt(req.body.cantidad, 10);
  if (!cantidad || cantidad <= 0) return res.status(400).json({ error: 'Cantidad inválida.' });

  // La verificación de stock va DENTRO de la transacción: así dos ventas
  // simultáneas nunca pueden dejar el stock en negativo.
  const resultado = db.transaction(() => {
    const product = findActive.get(req.params.id);
    if (!product) return { status: 404, error: 'Producto no encontrado.' };
    if (cantidad > product.stock) {
      return { status: 409, error: `Stock insuficiente: solo quedan ${product.stock} unidad(es) de ${product.nombre}.` };
    }

    const monto = r2(cantidad * product.precio);
    const pagos = normalizarPagos(req.body, monto);
    db.prepare('UPDATE inventory SET stock = stock - ? WHERE id = ?').run(cantidad, product.id);

    // Guardamos el precio de venta y el costo EN ESE MOMENTO: si luego
    // cambian, la ganancia histórica de esta venta no se altera.
    movement(product.id, 'venta', cantidad, 'Venta a huésped', req.user.sub, {
      precio_venta: product.precio, costo_unitario: product.costo || 0,
    });

    const financeId = newId();
    const creado = nowISO();
    db.prepare(`
      INSERT INTO finance (id, fecha, concepto, tipo, monto, metodo, referencia_estancia_id, created_by, created_at)
      VALUES (?, ?, ?, 'ingreso', ?, ?, NULL, ?, ?)
    `).run(financeId, today(), `Venta: ${product.nombre} x${cantidad}`, monto, metodoResumen(pagos), req.user.sub, creado);
    registrarPagos(db, financeId, pagos, creado);

    let comprobante = null;
    const comp = req.body.comprobante;
    if (comp && comp.tipo && comp.tipo !== 'ninguno') {
      comprobante = emitir(db, {
        tipo: comp.tipo, cliente: comp,
        items: [{ descripcion: product.nombre, unidad: 'UND', cantidad, precio_unitario: product.precio, importe: monto }],
        total: monto, pagos, recibido: req.body.recibido, financeId, user: req.user,
      });
    }
    return { product, monto, pagos, comprobante };
  })();

  if (resultado.error) return res.status(resultado.status).json({ error: resultado.error });
  const { product, monto, pagos, comprobante } = resultado;

  realtime.broadcast('inventory:changed', { reason: 'sale' });
  realtime.broadcast('finance:changed', { reason: 'sale' });
  sheets.appendRow('Finanzas', [today(), `Venta: ${product.nombre} x${cantidad}`, 'ingreso', monto, pagos.map(p => `${p.metodo} ${p.monto.toFixed(2)}`).join(' + '), nowISO()]);
  res.json({ ok: true, nuevoStock: product.stock - cantidad, monto, pagos, comprobante });
}

/** POST /api/inventory/:id/adjust — corrección manual de stock (solo admin), queda en la auditoría. */
function adjust(req, res) {
  const delta = parseInt(req.body.delta, 10); // puede ser negativo o positivo
  const motivo = String(req.body.motivo || 'Ajuste manual').slice(0, 200);
  if (!delta) return res.status(400).json({ error: 'Indica cuánto ajustar (positivo o negativo).' });

  const resultado = db.transaction(() => {
    const product = findActive.get(req.params.id);
    if (!product) return { status: 404, error: 'Producto no encontrado.' };
    if (product.stock + delta < 0) return { status: 409, error: 'El ajuste dejaría el stock en negativo.' };
    db.prepare('UPDATE inventory SET stock = stock + ? WHERE id = ?').run(delta, product.id);
    movement(product.id, 'ajuste', delta, motivo, req.user.sub);
    return { nuevoStock: product.stock + delta };
  })();

  if (resultado.error) return res.status(resultado.status).json({ error: resultado.error });
  realtime.broadcast('inventory:changed', { reason: 'adjust' });
  res.json({ ok: true, nuevoStock: resultado.nuevoStock });
}

/**
 * GET /api/inventory/ganancias
 * ---------------------------------------------------------------
 *   - valorVenta / valorCosto: el inventario actual valorizado a
 *     precio de venta y a precio de costo.
 *   - gananciaPotencial: lo que ganarías vendiendo TODO el stock actual.
 *   - margenPromedio: gananciaPotencial como % del costo invertido.
 *   - gananciaHistorica: lo que YA se ganó en ventas reales (con el
 *     precio y costo guardados en cada venta, incluso de productos
 *     que luego se eliminaron del catálogo).
 */
function ganancias(req, res) {
  const productos = db.prepare('SELECT * FROM inventory WHERE activo = 1').all();
  const valorVenta = productos.reduce((a, p) => a + Number(p.stock) * Number(p.precio), 0);
  const valorCosto = productos.reduce((a, p) => a + Number(p.stock) * Number(p.costo || 0), 0);
  const gananciaPotencial = valorVenta - valorCosto;
  const margenPromedio = valorCosto > 0 ? (gananciaPotencial / valorCosto) * 100 : 0;

  const ventas = db.prepare(`SELECT cantidad, precio_venta, costo_unitario FROM inventory_movements WHERE tipo = 'venta'`).all();
  const gananciaHistorica = ventas.reduce((a, v) => a + v.cantidad * ((v.precio_venta || 0) - (v.costo_unitario || 0)), 0);
  const ingresosPorVentas = ventas.reduce((a, v) => a + v.cantidad * (v.precio_venta || 0), 0);

  res.json({ valorVenta, valorCosto, gananciaPotencial, margenPromedio, gananciaHistorica, ingresosPorVentas });
}

module.exports = { list, create, update, remove, sell, adjust, ganancias };
