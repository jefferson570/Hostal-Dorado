/**
 * utils/comprobantes.js
 * ---------------------------------------------------------------
 * Emisión de boletas y facturas con numeración correlativa por serie
 * (B001-00000001, F001-00000001…) y cálculo del IGV.
 *
 * Los precios del hostal INCLUYEN IGV: el total cobrado se desglosa en
 * "Op. gravada" + "IGV". Si el hostal está en un régimen sin IGV (p. ej.
 * Nuevo RUS), basta con poner el IGV en 0 en Configuración.
 *
 * Importante: estos comprobantes se generan e imprimen en el propio
 * sistema. Para que tengan validez tributaria como comprobantes
 * ELECTRÓNICOS deben enviarse a SUNAT (a través de un OSE/PSE); el
 * formato y la numeración ya están preparados para esa integración.
 */
const { newId } = require('./ids');
const { r2, error400 } = require('./pagos');

const AJUSTES_DEFECTO = {
  nombre_comercial: 'Hostal Dorado',
  razon_social: 'HOSTAL DORADO',
  ruc: '',
  direccion: 'Arequipa, Perú',
  telefono: '',
  email: '',
  serie_boleta: 'B001',
  serie_factura: 'F001',
  igv_porcentaje: '18',
  mensaje_pie: '¡Gracias por su preferencia! Vuelva pronto.',
};
const CLAVES = Object.keys(AJUSTES_DEFECTO);

function getAjustes(db) {
  const guardados = Object.fromEntries(db.prepare('SELECT clave, valor FROM ajustes').all().map(r => [r.clave, r.valor]));
  const out = {};
  for (const k of CLAVES) out[k] = guardados[k] != null ? guardados[k] : AJUSTES_DEFECTO[k];
  return out;
}

function setAjustes(db, datos) {
  const up = db.prepare('INSERT INTO ajustes (clave, valor) VALUES (?, ?) ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor');
  db.transaction(() => {
    for (const k of CLAVES) if (datos[k] !== undefined) up.run(k, String(datos[k]).trim());
  })();
  return getAjustes(db);
}

/**
 * Valida los datos del cliente según el tipo de comprobante:
 *  - Factura: RUC de 11 dígitos + razón social (obligatorios).
 *  - Boleta: documento opcional; desde S/ 700 SUNAT exige identificar
 *    al cliente, así que ahí el documento y el nombre son obligatorios.
 */
function validarCliente(tipo, c = {}, total = 0) {
  const doc = String(c.doc || '').trim().toUpperCase();
  const nombre = String(c.nombre || '').trim().slice(0, 120);
  const direccion = String(c.direccion || '').trim().slice(0, 160) || null;

  if (tipo === 'factura') {
    if (!/^(10|15|16|17|20)\d{9}$/.test(doc)) throw error400('Para factura ingresa un RUC válido de 11 dígitos.');
    if (nombre.length < 3) throw error400('Para factura ingresa la razón social del cliente.');
    return { doc_tipo: 'RUC', doc, nombre: nombre.toUpperCase(), direccion };
  }

  let docTipo = ['DNI', 'CE', 'PAS'].includes(c.doc_tipo) ? c.doc_tipo : (doc ? 'DNI' : null);
  if (doc) {
    if (docTipo === 'DNI' && !/^\d{8}$/.test(doc)) throw error400('El DNI debe tener 8 dígitos.');
    if (docTipo !== 'DNI' && !/^[A-Z0-9]{5,15}$/.test(doc)) throw error400('El documento debe tener entre 5 y 15 caracteres.');
  } else {
    docTipo = null;
  }
  if (r2(total) >= 700 && (!doc || nombre.length < 3)) {
    throw error400('Para boletas desde S/ 700 SUNAT exige el documento y el nombre del cliente.');
  }
  return { doc_tipo: docTipo, doc: doc || null, nombre: (nombre || 'CLIENTE VARIOS').toUpperCase(), direccion };
}

const codigo = c => `${c.serie}-${String(c.numero).padStart(8, '0')}`;

function parse(row) {
  if (!row) return null;
  return {
    ...row,
    codigo: codigo(row),
    items: JSON.parse(row.items),
    pagos: JSON.parse(row.pagos),
    emisor: JSON.parse(row.emisor),
  };
}

/**
 * Emite un comprobante. Debe llamarse DENTRO de la transacción del
 * cobro (checkout, venta…), así el número correlativo y el pago se
 * guardan juntos o no se guarda nada.
 */
function emitir(db, { tipo, cliente, items, total, pagos, recibido, financeId, user }) {
  if (!['boleta', 'factura'].includes(tipo)) throw error400('Tipo de comprobante inválido.');
  const aj = getAjustes(db);
  const cli = validarCliente(tipo, cliente, total);
  const serie = (tipo === 'factura' ? aj.serie_factura : aj.serie_boleta) || (tipo === 'factura' ? 'F001' : 'B001');
  const numero = (db.prepare('SELECT MAX(numero) AS n FROM comprobantes WHERE serie = ?').get(serie).n || 0) + 1;

  const igvPct = Math.max(0, Number(aj.igv_porcentaje) || 0);
  const totalR = r2(total);
  const subtotal = r2(totalR / (1 + igvPct / 100));
  const igv = r2(totalR - subtotal);

  // Vuelto: solo si se indicó con cuánto pagó en efectivo.
  const efectivo = r2(pagos.filter(p => p.metodo === 'Efectivo').reduce((a, p) => a + p.monto, 0));
  let rec = recibido != null && recibido !== '' ? r2(recibido) : null;
  let vuelto = null;
  if (rec != null && efectivo > 0) {
    if (rec < efectivo) throw error400(`El efectivo recibido (S/ ${rec.toFixed(2)}) es menor al monto en efectivo (S/ ${efectivo.toFixed(2)}).`);
    vuelto = r2(rec - efectivo);
  } else {
    rec = null;
  }

  const emisor = {
    nombre_comercial: aj.nombre_comercial, razon_social: aj.razon_social, ruc: aj.ruc,
    direccion: aj.direccion, telefono: aj.telefono, email: aj.email, mensaje_pie: aj.mensaje_pie,
  };
  const row = {
    id: newId(), tipo, serie, numero,
    cliente_doc_tipo: cli.doc_tipo, cliente_doc: cli.doc, cliente_nombre: cli.nombre, cliente_direccion: cli.direccion,
    items: JSON.stringify(items.map(i => ({
      descripcion: String(i.descripcion).slice(0, 160),
      unidad: i.unidad || 'UND',
      cantidad: Number(i.cantidad),
      precio_unitario: r2(i.precio_unitario),
      importe: r2(i.importe),
    }))),
    subtotal, igv, igv_pct: igvPct, total: totalR,
    pagos: JSON.stringify(pagos), recibido: rec, vuelto,
    emisor: JSON.stringify(emisor),
    finance_id: financeId || null, estado: 'emitido', motivo_anulacion: null,
    created_by: user.sub, created_by_nombre: user.nombre, created_at: new Date().toISOString(),
  };
  db.prepare(`
    INSERT INTO comprobantes (id, tipo, serie, numero, cliente_doc_tipo, cliente_doc, cliente_nombre, cliente_direccion,
      items, subtotal, igv, igv_pct, total, pagos, recibido, vuelto, emisor, finance_id, estado, motivo_anulacion,
      created_by, created_by_nombre, created_at)
    VALUES (@id, @tipo, @serie, @numero, @cliente_doc_tipo, @cliente_doc, @cliente_nombre, @cliente_direccion,
      @items, @subtotal, @igv, @igv_pct, @total, @pagos, @recibido, @vuelto, @emisor, @finance_id, @estado, @motivo_anulacion,
      @created_by, @created_by_nombre, @created_at)
  `).run(row);
  return parse(row);
}

module.exports = { AJUSTES_DEFECTO, getAjustes, setAjustes, validarCliente, emitir, parse, codigo };
