/**
 * middleware/cobro.js
 * Validaciones comunes a todo cobro (check-out, venta, ingreso manual):
 * método único o pagos mixtos, efectivo recibido y datos del comprobante.
 * La regla fina (que los pagos sumen exactamente el total, RUC válido,
 * etc.) la aplican utils/pagos.js y utils/comprobantes.js.
 */
const { body } = require('express-validator');
const { METODOS } = require('../utils/pagos');

const METODOS_OK = [...METODOS, 'Yape/Plin'];

const validarCobro = [
  body('metodo_pago').optional({ values: 'falsy' }).isIn(METODOS_OK).withMessage('Selecciona un método de pago válido.'),
  body('metodo').optional({ values: 'falsy' }).isIn(METODOS_OK).withMessage('Selecciona un método de pago válido.'),
  body('pagos').optional().isArray({ min: 1, max: 5 }).withMessage('Pagos inválidos.'),
  body('pagos.*.metodo').optional().isIn(METODOS_OK).withMessage('Método de pago inválido.'),
  body('pagos.*.monto').optional().isFloat({ min: 0, max: 1000000 }).withMessage('Monto de pago inválido.'),
  body('recibido').optional({ values: 'null' }).isFloat({ min: 0, max: 1000000 }).withMessage('Efectivo recibido inválido.'),
  body('comprobante').optional({ values: 'null' }).isObject().withMessage('Datos del comprobante inválidos.'),
  body('comprobante.tipo').optional().isIn(['ninguno', 'boleta', 'factura']).withMessage('Tipo de comprobante inválido.'),
  body('comprobante.doc_tipo').optional({ values: 'falsy' }).isIn(['DNI', 'CE', 'PAS', 'RUC']).withMessage('Tipo de documento inválido.'),
  body('comprobante.doc').optional({ values: 'falsy' }).isString().isLength({ max: 15 }).withMessage('Documento inválido.'),
  body('comprobante.nombre').optional({ values: 'falsy' }).isString().isLength({ max: 120 }).withMessage('Nombre demasiado largo.'),
  body('comprobante.direccion').optional({ values: 'falsy' }).isString().isLength({ max: 160 }).withMessage('Dirección demasiado larga.'),
];

module.exports = { validarCobro };
