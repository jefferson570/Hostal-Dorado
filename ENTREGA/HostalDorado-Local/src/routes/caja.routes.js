/**
 * routes/caja.routes.js
 * Caja (cierres), comprobantes, usuarios y datos del hostal.
 * Todas requieren sesión; lo delicado es solo para administrador.
 */
const express = require('express');
const { body, param } = require('express-validator');
const validate = require('../middleware/validate');
const { requireAuth, requireRole } = require('../middleware/auth');
const caja = require('../controllers/caja.controller');
const comprobantes = require('../controllers/comprobantes.controller');
const users = require('../controllers/users.controller');
const db = require('../db');
const { getAjustes, setAjustes } = require('../utils/comprobantes');

const idParam = param('id').isUUID().withMessage('Identificador inválido.');
const monto = campo => body(campo).optional({ values: 'null' }).isFloat({ min: 0, max: 1000000 }).withMessage('Monto inválido.');

/* ---------- Cierre de caja (admin y recepción) ---------- */
const cajaRouter = express.Router();
cajaRouter.use(requireAuth);
cajaRouter.get('/actual', caja.actual);
cajaRouter.get('/cierres', caja.list);
cajaRouter.get('/cierres/:id', [idParam], validate, caja.get);
cajaRouter.post('/cerrar',
  requireRole('admin', 'recepcion'),
  [
    body('tipo').optional().isIn(['turno', 'general']).withMessage('Tipo de cierre inválido.'),
    monto('fondo_inicial'),
    monto('efectivo_contado'),
    body('observaciones').optional({ values: 'falsy' }).isString().isLength({ max: 300 }).withMessage('Observaciones demasiado largas.'),
  ],
  validate,
  caja.cerrar
);

/* ---------- Comprobantes ---------- */
const compRouter = express.Router();
compRouter.use(requireAuth);
compRouter.get('/', comprobantes.list);
compRouter.get('/:id', [idParam], validate, comprobantes.get);
compRouter.post('/',
  requireRole('admin', 'recepcion'),
  [
    body('finance_id').isUUID().withMessage('Movimiento inválido.'),
    body('tipo').isIn(['boleta', 'factura']).withMessage('Elige boleta o factura.'),
    body('doc_tipo').optional({ values: 'falsy' }).isIn(['DNI', 'CE', 'PAS', 'RUC']),
    body('doc').optional({ values: 'falsy' }).isString().isLength({ max: 15 }),
    body('nombre').optional({ values: 'falsy' }).isString().isLength({ max: 120 }),
    body('direccion').optional({ values: 'falsy' }).isString().isLength({ max: 160 }),
  ],
  validate,
  comprobantes.createFromMovimiento
);
compRouter.patch('/:id/anular',
  requireRole('admin'),
  [idParam, body('motivo').trim().isLength({ min: 3, max: 200 }).withMessage('Indica el motivo de la anulación.')],
  validate,
  comprobantes.anular
);

/* ---------- Usuarios (solo admin) ---------- */
const usersRouter = express.Router();
usersRouter.use(requireAuth, requireRole('admin'));
const vNombre = body('nombre').trim().isLength({ min: 2, max: 60 }).withMessage('El nombre debe tener entre 2 y 60 caracteres.');
const vPass = body('password').isLength({ min: 8, max: 128 }).withMessage('La contraseña debe tener al menos 8 caracteres.');
usersRouter.get('/', users.list);
usersRouter.post('/',
  [
    vNombre,
    body('username').trim().isLength({ min: 3, max: 30 }).withMessage('El usuario debe tener entre 3 y 30 caracteres.')
      .matches(/^[a-zA-Z0-9._-]+$/).withMessage('El usuario solo puede tener letras, números, puntos y guiones.'),
    vPass,
    body('role').isIn(['admin', 'recepcion']).withMessage('Rol inválido.'),
  ],
  validate,
  users.create
);
usersRouter.patch('/:id',
  [
    idParam,
    vNombre.optional(),
    vPass.optional({ values: 'falsy' }),
    body('role').optional().isIn(['admin', 'recepcion']).withMessage('Rol inválido.'),
    body('activo').optional().isBoolean().withMessage('Estado inválido.'),
  ],
  validate,
  users.update
);

/* ---------- Datos del hostal para comprobantes ---------- */
const ajustesRouter = express.Router();
ajustesRouter.use(requireAuth);
ajustesRouter.get('/', (req, res) => res.json({ ajustes: getAjustes(db) }));
ajustesRouter.put('/',
  requireRole('admin'),
  [
    body('nombre_comercial').optional().trim().isLength({ min: 2, max: 80 }).withMessage('Nombre comercial inválido.'),
    body('razon_social').optional().trim().isLength({ min: 2, max: 120 }).withMessage('Razón social inválida.'),
    body('ruc').optional({ values: 'falsy' }).trim().matches(/^(10|15|16|17|20)\d{9}$/).withMessage('El RUC debe tener 11 dígitos.'),
    body(['direccion', 'mensaje_pie']).optional().trim().isLength({ max: 160 }),
    body(['telefono']).optional().trim().isLength({ max: 30 }),
    body(['email']).optional({ values: 'falsy' }).trim().isEmail().withMessage('Correo inválido.'),
    body(['serie_boleta']).optional().trim().matches(/^B[A-Z0-9]{3}$/).withMessage('La serie de boleta debe ser como B001.'),
    body(['serie_factura']).optional().trim().matches(/^F[A-Z0-9]{3}$/).withMessage('La serie de factura debe ser como F001.'),
    body('igv_porcentaje').optional().isFloat({ min: 0, max: 30 }).withMessage('IGV inválido.'),
  ],
  validate,
  (req, res) => res.json({ ajustes: setAjustes(db, req.body) })
);

module.exports = { cajaRouter, compRouter, usersRouter, ajustesRouter };
