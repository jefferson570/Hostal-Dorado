const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');
const db = require('../db');
const config = require('../config');
const { hoy } = require('../utils/fechas');
const { METODOS, pagosPorMovimiento } = require('../utils/pagos');
const { parse, codigo } = require('../utils/comprobantes');

const fechaHoraLocal = iso => new Date(iso).toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' });
const horaLocal = iso => new Date(iso).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });

/**
 * Protección contra "inyección de fórmulas": si un texto escrito por un
 * cliente (ej. su nombre en el sitio público) empieza con = + - @, Excel
 * lo interpretaría como fórmula al abrir el archivo. Anteponer un apóstrofo
 * hace que se muestre como texto literal.
 */
const celdaSegura = v => (typeof v === "string" && /^[=+\-@\t\r]/.test(v) ? "'" + v : v);
const filaSegura = row => Object.fromEntries(Object.entries(row).map(([k, v]) => [k, celdaSegura(v)]));

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
    rows.forEach(r => sheet.addRow(filaSegura(r)));
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

  // ---- Finanzas (con el desglose de cada pago por método) ----
  const finance = db.prepare(`
    SELECT f.id, f.fecha, f.concepto, f.tipo, f.monto, f.metodo, u.nombre AS registrado_por, f.created_at
    FROM finance f LEFT JOIN users u ON u.id = f.created_by
    ORDER BY f.created_at DESC
  `).all();
  const pagos = pagosPorMovimiento(db, finance.map(f => f.id));
  const compPorMov = {};
  for (const c of db.prepare(`SELECT serie, numero, finance_id FROM comprobantes WHERE estado = 'emitido' AND finance_id IS NOT NULL`).all()) {
    compPorMov[c.finance_id] = codigo(c);
  }
  const finSheet = addSheet('Finanzas',
    [
      { header: 'Fecha', key: 'fecha', width: 12 },
      { header: 'Hora', key: 'hora', width: 9 },
      { header: 'Concepto', key: 'concepto', width: 40 },
      { header: 'Tipo', key: 'tipo', width: 10 },
      { header: 'Monto (S/)', key: 'monto', width: 12 },
      { header: 'Forma de pago', key: 'forma', width: 30 },
      ...METODOS.map(m => ({ header: `${m} (S/)`, key: 'm_' + m, width: 13 })),
      { header: 'Comprobante', key: 'comprobante', width: 16 },
      { header: 'Registrado por', key: 'registrado_por', width: 18 },
    ],
    finance.map(f => {
      const ps = pagos[f.id] || [{ metodo: f.metodo, monto: f.monto }];
      const signo = f.tipo === 'egreso' ? -1 : 1;
      const fila = {
        fecha: f.fecha, hora: horaLocal(f.created_at), concepto: f.concepto, tipo: f.tipo,
        monto: signo * f.monto,
        forma: ps.map(p => ps.length > 1 ? `${p.metodo} ${p.monto.toFixed(2)}` : p.metodo).join(' + '),
        comprobante: compPorMov[f.id] || '', registrado_por: f.registrado_por || '',
      };
      for (const m of METODOS) {
        const t = ps.filter(p => p.metodo === m).reduce((a, p) => a + p.monto, 0);
        fila['m_' + m] = t ? signo * t : '';
      }
      return fila;
    })
  );
  // Fila de totales al final: suma por método (ingresos − egresos).
  const tot = finSheet.addRow({
    concepto: 'TOTAL (ingresos − egresos)',
    monto: finance.reduce((a, f) => a + (f.tipo === 'egreso' ? -f.monto : f.monto), 0),
    ...Object.fromEntries(METODOS.map(m => ['m_' + m, finance.reduce((a, f) =>
      a + (pagos[f.id] || []).filter(p => p.metodo === m).reduce((x, p) => x + (f.tipo === 'egreso' ? -p.monto : p.monto), 0), 0)])),
  });
  tot.font = { bold: true };
  finSheet.getColumn('monto').numFmt = '#,##0.00';
  for (const m of METODOS) finSheet.getColumn('m_' + m).numFmt = '#,##0.00';

  // ---- Comprobantes emitidos ----
  const comps = db.prepare('SELECT * FROM comprobantes ORDER BY created_at DESC').all().map(parse);
  addSheet('Comprobantes',
    [
      { header: 'Número', key: 'codigo', width: 16 },
      { header: 'Tipo', key: 'tipo', width: 10 },
      { header: 'Fecha y hora', key: 'fecha', width: 20 },
      { header: 'Cliente', key: 'cliente', width: 32 },
      { header: 'Documento', key: 'doc', width: 18 },
      { header: 'Op. gravada (S/)', key: 'subtotal', width: 15 },
      { header: 'IGV (S/)', key: 'igv', width: 11 },
      { header: 'Total (S/)', key: 'total', width: 12 },
      { header: 'Forma de pago', key: 'forma', width: 30 },
      { header: 'Estado', key: 'estado', width: 11 },
      { header: 'Emitido por', key: 'usuario', width: 18 },
    ],
    comps.map(c => ({
      codigo: c.codigo, tipo: c.tipo === 'factura' ? 'Factura' : 'Boleta', fecha: fechaHoraLocal(c.created_at),
      cliente: c.cliente_nombre, doc: c.cliente_doc ? `${c.cliente_doc_tipo} ${c.cliente_doc}` : '',
      subtotal: c.subtotal, igv: c.igv, total: c.total,
      forma: c.pagos.map(p => `${p.metodo} ${p.monto.toFixed(2)}`).join(' + '),
      estado: c.estado === 'anulado' ? 'ANULADO' : 'Emitido', usuario: c.created_by_nombre,
    }))
  );

  // ---- Cierres de caja ----
  const cierres = db.prepare('SELECT * FROM cierres_caja ORDER BY numero DESC').all();
  addSheet('Cierres de caja',
    [
      { header: 'N.º', key: 'numero', width: 7 },
      { header: 'Desde', key: 'desde', width: 20 },
      { header: 'Hasta', key: 'hasta', width: 20 },
      { header: 'Ingresos (S/)', key: 'ingresos', width: 14 },
      { header: 'Egresos (S/)', key: 'egresos', width: 13 },
      { header: 'Neto (S/)', key: 'neto', width: 12 },
      ...METODOS.map(m => ({ header: `${m} neto (S/)`, key: 'n_' + m, width: 15 })),
      { header: 'Fondo inicial', key: 'fondo', width: 13 },
      { header: 'Efectivo esperado', key: 'esperado', width: 16 },
      { header: 'Efectivo contado', key: 'contado', width: 16 },
      { header: 'Diferencia', key: 'diferencia', width: 12 },
      { header: 'Cerrado por', key: 'usuario', width: 18 },
      { header: 'Observaciones', key: 'obs', width: 30 },
    ],
    cierres.map(c => {
      const r = JSON.parse(c.resumen);
      return {
        numero: c.numero, desde: c.desde.startsWith('1970') ? 'Inicio' : fechaHoraLocal(c.desde), hasta: fechaHoraLocal(c.hasta),
        ingresos: r.totales.ingresos, egresos: r.totales.egresos, neto: r.totales.neto,
        ...Object.fromEntries(METODOS.map(m => ['n_' + m, r.por_metodo[m] ? r.por_metodo[m].neto : 0])),
        fondo: r.fondo_inicial, esperado: r.efectivo_esperado,
        contado: r.efectivo_contado ?? '', diferencia: r.diferencia ?? '',
        usuario: c.created_by_nombre, obs: c.observaciones || '',
      };
    })
  );

  // ---- Inventario ----
  const inventory = db.prepare(`SELECT * FROM inventory WHERE activo = 1 ORDER BY nombre ASC`).all();
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

  const filename = `reporte-hostal-dorado-${hoy()}.xlsx`;
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
  const filename = `hostal-dorado-backup-${hoy()}.db`;
  res.download(dbFile, filename);
}

module.exports = { reporte, backup };
