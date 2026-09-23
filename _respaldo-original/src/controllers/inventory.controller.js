const db = require('../db');
const { newId } = require('../utils/ids');
const realtime = require('../realtime');
const sheets = require('../backup/googleSheets');

const nowISO = () => new Date().toISOString();
const today = () => new Date().toISOString().slice(0, 10);

function list(req, res) {
  const rows = db.prepare('SELECT * FROM inventory ORDER BY nombre ASC').all();
  res.json({ inventory: rows });
}

/**
 * POST /api/inventory
 * ---------------------------------------------------------------
 * Bug reportado: al querer "aumentar stock" escribiendo de nuevo el
 * nombre de un producto ya existente en este mismo formulario, se
 * creaba un producto DUPLICADO en vez de sumar al stock del que ya
 * existía. La causa era que create() insertaba siempre una fila
 * nueva sin comprobar si el nombre ya estaba en uso.
 *
 * Ahora: si ya existe un producto con ese nombre (sin importar
 * mayúsculas/espacios), NO se crea uno nuevo — se le suma el stock
 * indicado al producto existente (igual que hace la acción rápida
 * "Ingreso de productos"), y se avisa cuál fue el producto actualizado.
 */
function create(req, res) {
  const { nombre, categoria, stock, stock_minimo, precio, costo } = req.body;
  const stockNum = parseInt(stock, 10) || 0;

  const existente = db.prepare(
    `SELECT * FROM inventory WHERE LOWER(TRIM(nombre)) = LOWER(TRIM(?))`
  ).get(nombre);

  if (existente) {
    if (stockNum > 0) {
      db.prepare('UPDATE inventory SET stock = stock + ? WHERE id = ?').run(stockNum, existente.id);
      db.prepare(`
        INSERT INTO inventory_movements (id, producto_id, tipo, cantidad, motivo, created_by, created_at)
        VALUES (?, ?, 'ajuste', ?, 'Reposición desde "Nuevo producto" (ya existía)', ?, ?)
      `).run(newId(), existente.id, stockNum, req.user.sub, nowISO());
    }
    const actualizado = db.prepare('SELECT * FROM inventory WHERE id = ?').get(existente.id);
    realtime.broadcast('inventory:changed', { reason: 'restock-existing' });
    return res.status(200).json({
      product: actualizado,
      yaExistia: true,
      mensaje: `"${existente.nombre}" ya existía: se le sumaron ${stockNum} unidad(es) de stock en vez de crear un producto duplicado.`,
    });
  }

  const row = {
    id: newId(), nombre, categoria: categoria || null,
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
  const product = db.prepare('SELECT * FROM inventory WHERE id = ?').get(req.params.id);
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

function remove(req, res) {
  const product = db.prepare('SELECT * FROM inventory WHERE id = ?').get(req.params.id);
  if (!product) return res.status(404).json({ error: 'Producto no encontrado.' });
  db.prepare('DELETE FROM inventory WHERE id = ?').run(product.id);
  realtime.broadcast('inventory:changed', { reason: 'delete' });
  res.json({ ok: true });
}

/**
 * POST /api/inventory/:id/sell
 * El corazón de "cada vez que se registre un producto vendido el
 * stock disminuya": se ejecuta dentro de una transacción para que,
 * si algo falla a mitad de camino, NO quede el stock descontado sin
 * su ingreso correspondiente en finanzas (o viceversa).
 */
function sell(req, res) {
  const product = db.prepare('SELECT * FROM inventory WHERE id = ?').get(req.params.id);
  if (!product) return res.status(404).json({ error: 'Producto no encontrado.' });

  const cantidad = parseInt(req.body.cantidad, 10);
  if (!cantidad || cantidad <= 0) return res.status(400).json({ error: 'Cantidad inválida.' });
  if (cantidad > product.stock) {
    return res.status(409).json({ error: `Stock insuficiente: solo quedan ${product.stock} unidad(es) de ${product.nombre}.` });
  }

  const monto = cantidad * product.precio;
  const db_ = require('../db');

  const runSale = db_.transaction(() => {
    db_.prepare('UPDATE inventory SET stock = stock - ? WHERE id = ?').run(cantidad, product.id);

    // Guardamos el precio de venta y el costo del producto EN ESE MOMENTO
    // (no solo el id): así, si el admin cambia el precio o el costo más
    // adelante, la ganancia histórica de esta venta ya registrada no se
    // recalcula sola con el precio nuevo — queda fiel a lo que pasó.
    db_.prepare(`
      INSERT INTO inventory_movements (id, producto_id, tipo, cantidad, motivo, precio_venta, costo_unitario, created_by, created_at)
      VALUES (?, ?, 'venta', ?, ?, ?, ?, ?, ?)
    `).run(newId(), product.id, cantidad, 'Venta a huésped', product.precio, product.costo || 0, req.user.sub, nowISO());

    const financeRow = {
      id: newId(), fecha: today(), concepto: `Venta: ${product.nombre} x${cantidad}`,
      tipo: 'ingreso', monto, metodo: req.body.metodo || 'Efectivo',
      referencia_estancia_id: null, created_by: req.user.sub, created_at: nowISO(),
    };
    db_.prepare(`
      INSERT INTO finance (id, fecha, concepto, tipo, monto, metodo, referencia_estancia_id, created_by, created_at)
      VALUES (@id, @fecha, @concepto, @tipo, @monto, @metodo, @referencia_estancia_id, @created_by, @created_at)
    `).run(financeRow);
  });

  runSale();

  realtime.broadcast('inventory:changed', { reason: 'sale' });
  realtime.broadcast('finance:changed', { reason: 'sale' });
  sheets.appendRow('Finanzas', [today(), `Venta: ${product.nombre} x${cantidad}`, 'ingreso', monto, req.body.metodo || 'Efectivo', nowISO()]);
  res.json({ ok: true, nuevoStock: product.stock - cantidad, monto });
}

/** POST /api/inventory/:id/adjust — corrección manual de stock (solo admin), queda en la auditoría. */
function adjust(req, res) {
  const product = db.prepare('SELECT * FROM inventory WHERE id = ?').get(req.params.id);
  if (!product) return res.status(404).json({ error: 'Producto no encontrado.' });

  const delta = parseInt(req.body.delta, 10); // puede ser negativo o positivo
  const motivo = req.body.motivo || 'Ajuste manual';
  if (!delta) return res.status(400).json({ error: 'Indica cuánto ajustar (positivo o negativo).' });
  if (product.stock + delta < 0) return res.status(409).json({ error: 'El ajuste dejaría el stock en negativo.' });

  db.prepare('UPDATE inventory SET stock = stock + ? WHERE id = ?').run(delta, product.id);
  db.prepare(`
    INSERT INTO inventory_movements (id, producto_id, tipo, cantidad, motivo, created_by, created_at)
    VALUES (?, ?, 'ajuste', ?, ?, ?, ?)
  `).run(newId(), product.id, delta, motivo, req.user.sub, nowISO());

  realtime.broadcast('inventory:changed', { reason: 'adjust' });
  res.json({ ok: true, nuevoStock: product.stock + delta });
}

/**
 * GET /api/inventory/ganancias
 * ---------------------------------------------------------------
 * Sección "Ganancias" pedida aparte de Stock bajo / Valor de
 * inventario / Productos activos / Unidades en stock:
 *   - valorVenta / valorCosto: el inventario actual valorizado a
 *     precio de venta y a precio de costo (de mercado/compra).
 *   - gananciaPotencial: lo que ganarías si vendieras TODO el stock
 *     actual al precio de venta de hoy.
 *   - margenPromedio: gananciaPotencial como % del costo invertido.
 *   - gananciaHistorica: lo que YA se ganó en ventas reales
 *     (usa el precio y costo guardados en cada movimiento de venta,
 *     no el precio actual — por eso es fiel al histórico real).
 */
function ganancias(req, res) {
  const productos = db.prepare('SELECT * FROM inventory').all();
  const valorVenta = productos.reduce((a, p) => a + Number(p.stock) * Number(p.precio), 0);
  const valorCosto = productos.reduce((a, p) => a + Number(p.stock) * Number(p.costo || 0), 0);
  const gananciaPotencial = valorVenta - valorCosto;
  const margenPromedio = valorCosto > 0 ? (gananciaPotencial / valorCosto) * 100 : 0;

  const ventas = db.prepare(`SELECT cantidad, precio_venta, costo_unitario FROM inventory_movements WHERE tipo = 'venta'`).all();
  const gananciaHistorica = ventas.reduce((a, v) => {
    const pv = v.precio_venta != null ? v.precio_venta : 0;
    const cu = v.costo_unitario != null ? v.costo_unitario : 0;
    return a + v.cantidad * (pv - cu);
  }, 0);
  const ingresosPorVentas = ventas.reduce((a, v) => a + v.cantidad * (v.precio_venta || 0), 0);

  res.json({ valorVenta, valorCosto, gananciaPotencial, margenPromedio, gananciaHistorica, ingresosPorVentas });
}

module.exports = { list, create, update, remove, sell, adjust, ganancias };
