const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');
const db = require('../db');
const config = require('../config');

/**
 * GET /api/export/reporte
 * ---------------------------------------------------------------
 * Genera un archivo .xlsx (Excel real, se abre en Excel, Google
 * Sheets, LibreOffice, etc.) con TODO lo que se ha registrado en el
 * sistema, organizado en varias hojas. Esto es lo que en un negocio
 * real se le entrega a contabilidad o a la gerencia a fin de mes.
 */
async function reporte(req, res) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Sistema Hostal Dorado';
  workbook.created = new Date();

  const headerStyle = { font: { bold: true, color: { argb: 'FFFFFFFF' } }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF241811' } } };

  function addSheet(name, columns, rows) {
    const sheet = workbook.addWorksheet(name);
    sheet.columns = columns;
    sheet.getRow(1).eachCell(cell => { cell.style = headerStyle; });
    sheet.autoFilter = { from: 'A1', to: `${String.fromCharCode(64 + columns.length)}1` };
    rows.forEach(r => sheet.addRow(r));
    return sheet;
  }

  // ---- Habitaciones ----
  const rooms = db.prepare(`
    SELECT r.numero, r.tipo, r.precio, r.estado,
           g.nombres AS huesped_nombres, g.apellidos AS huesped_apellidos
    FROM rooms r
    LEFT JOIN stays s ON s.room_id = r.id AND s.estado = 'activa'
    LEFT JOIN guests g ON g.id = s.guest_id
    ORDER BY CAST(r.numero AS INTEGER)
  `).all();
  addSheet('Habitaciones',
    [
      { header: 'Número', key: 'numero', width: 12 },
      { header: 'Tipo', key: 'tipo', width: 16 },
      { header: 'Precio/noche (S/)', key: 'precio', width: 16 },
      { header: 'Estado', key: 'estado', width: 16 },
      { header: 'Huésped actual', key: 'huesped', width: 30 },
    ],
    rooms.map(r => ({ numero: r.numero, tipo: r.tipo, precio: r.precio, estado: r.estado, huesped: r.huesped_nombres ? `${r.huesped_nombres} ${r.huesped_apellidos}` : '' }))
  );

  // ---- Huéspedes ----
  const guests = db.prepare(`SELECT * FROM guests ORDER BY created_at DESC`).all();
  addSheet('Huéspedes',
    [
      { header: 'Tipo documento', key: 'tipo_documento', width: 18 },
      { header: 'N.º documento', key: 'numero_documento', width: 16 },
      { header: 'Nombres', key: 'nombres', width: 20 },
      { header: 'Apellidos', key: 'apellidos', width: 20 },
      { header: 'Nacionalidad', key: 'nacionalidad', width: 16 },
      { header: 'Procedencia', key: 'procedencia', width: 16 },
      { header: 'Destino', key: 'destino', width: 16 },
      { header: 'Teléfono', key: 'telefono', width: 16 },
      { header: 'Registrado el', key: 'created_at', width: 20 },
    ],
    guests
  );

  // ---- Estancias (historial check-in / check-out) ----
  const stays = db.prepare(`
    SELECT r.numero AS habitacion, g.nombres, g.apellidos, g.tipo_documento, g.numero_documento,
           s.checkin_date, s.checkout_date, s.nights, s.price_per_night, s.total, s.estado
    FROM stays s
    JOIN rooms r ON r.id = s.room_id
    JOIN guests g ON g.id = s.guest_id
    ORDER BY s.checkin_date DESC
  `).all();
  addSheet('Estancias',
    [
      { header: 'Habitación', key: 'habitacion', width: 12 },
      { header: 'Huésped', key: 'huesped', width: 26 },
      { header: 'Documento', key: 'documento', width: 20 },
      { header: 'Check-in', key: 'checkin_date', width: 14 },
      { header: 'Check-out', key: 'checkout_date', width: 14 },
      { header: 'Noches', key: 'nights', width: 10 },
      { header: 'Precio/noche (S/)', key: 'price_per_night', width: 16 },
      { header: 'Total (S/)', key: 'total', width: 14 },
      { header: 'Estado', key: 'estado', width: 12 },
    ],
    stays.map(s => ({
      habitacion: s.habitacion, huesped: `${s.nombres} ${s.apellidos}`,
      documento: `${s.tipo_documento} ${s.numero_documento}`,
      checkin_date: s.checkin_date, checkout_date: s.checkout_date || '',
      nights: s.nights, price_per_night: s.price_per_night, total: s.total || '', estado: s.estado,
    }))
  );

  // ---- Finanzas ----
  const finance = db.prepare(`
    SELECT f.fecha, f.concepto, f.tipo, f.monto, f.metodo, u.nombre AS registrado_por, f.created_at
    FROM finance f LEFT JOIN users u ON u.id = f.created_by
    ORDER BY f.created_at DESC
  `).all();
  addSheet('Finanzas',
    [
      { header: 'Fecha', key: 'fecha', width: 14 },
      { header: 'Concepto', key: 'concepto', width: 36 },
      { header: 'Tipo', key: 'tipo', width: 12 },
      { header: 'Monto (S/)', key: 'monto', width: 14 },
      { header: 'Método', key: 'metodo', width: 16 },
      { header: 'Registrado por', key: 'registrado_por', width: 18 },
      { header: 'Fecha de registro', key: 'created_at', width: 22 },
    ],
    finance
  );

  // ---- Inventario ----
  const inventory = db.prepare(`SELECT * FROM inventory ORDER BY nombre ASC`).all();
  addSheet('Inventario',
    [
      { header: 'Producto', key: 'nombre', width: 24 },
      { header: 'Categoría', key: 'categoria', width: 16 },
      { header: 'Stock', key: 'stock', width: 10 },
      { header: 'Stock mínimo', key: 'stock_minimo', width: 14 },
      { header: 'Costo (S/)', key: 'costo', width: 12 },
      { header: 'Precio (S/)', key: 'precio', width: 12 },
      { header: 'Valor en stock (S/)', key: 'valor', width: 18 },
      { header: 'Ganancia potencial (S/)', key: 'ganancia', width: 20 },
    ],
    inventory.map(p => ({ ...p, valor: (p.stock * p.precio).toFixed(2), ganancia: (p.stock * (p.precio - (p.costo || 0))).toFixed(2) }))
  );

  // ---- Movimientos de inventario (auditoría de ventas/ajustes) ----
  const movs = db.prepare(`
    SELECT i.nombre AS producto, m.tipo, m.cantidad, m.motivo, u.nombre AS registrado_por, m.created_at
    FROM inventory_movements m
    JOIN inventory i ON i.id = m.producto_id
    LEFT JOIN users u ON u.id = m.created_by
    ORDER BY m.created_at DESC
  `).all();
  addSheet('Movimientos de inventario',
    [
      { header: 'Producto', key: 'producto', width: 24 },
      { header: 'Tipo', key: 'tipo', width: 12 },
      { header: 'Cantidad', key: 'cantidad', width: 12 },
      { header: 'Motivo', key: 'motivo', width: 24 },
      { header: 'Registrado por', key: 'registrado_por', width: 18 },
      { header: 'Fecha', key: 'created_at', width: 22 },
    ],
    movs
  );

  const filename = `reporte-hostal-dorado-${new Date().toISOString().slice(0,10)}.xlsx`;
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  await workbook.xlsx.write(res);
  res.end();
}

/**
 * GET /api/export/backup
 * ---------------------------------------------------------------
 * Descarga el archivo real de la base de datos SQLite. Es el respaldo
 * más completo posible: contiene absolutamente todo (usuarios,
 * habitaciones, huéspedes, estancias, finanzas, inventario). Solo el
 * administrador puede descargarlo, porque incluye las contraseñas
 * cifradas de los usuarios.
 *
 * `wal_checkpoint(FULL)` fuerza a SQLite a volcar los cambios
 * recientes (que en modo WAL viven en un archivo aparte) dentro del
 * archivo principal .db antes de copiarlo, para no perder nada.
 */
function backup(req, res) {
  db.pragma('wal_checkpoint(FULL)');
  const dbFile = path.resolve(config.dbPath);
  if (!fs.existsSync(dbFile)) return res.status(404).json({ error: 'No se encontró el archivo de base de datos.' });
  const filename = `hostal-dorado-backup-${new Date().toISOString().slice(0,10)}.db`;
  res.download(dbFile, filename);
}

module.exports = { reporte, backup };
