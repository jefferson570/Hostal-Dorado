const express = require('express');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { requireAuth, requireRole } = require('../middleware/auth');
const ctrl = require('../controllers/rooms.controller');
const { validarCobro } = require('../middleware/cobro');

const router = express.Router();

router.use(requireAuth); // todas las rutas de habitaciones requieren sesión iniciada

router.get('/', ctrl.list);

router.post('/',
  requireRole('admin'),
  [
    body('numero').trim().notEmpty().withMessage('El número de habitación es obligatorio.')
      .isLength({ max: 10 }).withMessage('Número de habitación demasiado largo.'),
    body('tipo').trim().notEmpty().withMessage('El tipo de habitación es obligatorio.')
      .isLength({ max: 40 }).withMessage('Tipo demasiado largo.'),
    body('categoria').optional({ values: 'falsy' }).trim().isLength({ max: 40 }),
    body('unidad').optional().isIn(['noche', 'hora']).withMessage('Unidad de cobro inválida.'),
    body('bloque_horas').optional({ values: 'null' }).isInt({ min: 1, max: 24 }).withMessage('Horas por bloque inválidas.'),
    body('precio').isFloat({ gt: 0, max: 100000 }).withMessage('El precio debe ser mayor a 0.'),
  ],
  validate,
  ctrl.create
);

router.patch('/:id',
  requireRole('admin', 'recepcion'),
  [
    body('estado').optional().isIn(['libre', 'limpieza', 'mantenimiento']).withMessage('Estado inválido.'),
    body('precio').optional().isFloat({ gt: 0, max: 100000 }).withMessage('El precio debe ser mayor a 0.'),
    body('tipo').optional().trim().notEmpty().isLength({ max: 40 }),
    body('categoria').optional().trim().notEmpty().isLength({ max: 40 }),
  ],
  validate,
  ctrl.update
);

router.delete('/:id', requireRole('admin'), ctrl.remove);

/**
 * Validación del documento de identidad según la normativa peruana:
 * - DNI: exactamente 8 dígitos numéricos.
 * - Pasaporte / Carné de Extranjería: alfanumérico, de 5 a 15 caracteres.
 * Esta es la ficha de registro que el Reglamento de Establecimientos
 * de Hospedaje exige conservar por cada huésped.
 */
const checkinValidators = [
  body('tipo_documento').isIn(['DNI', 'Pasaporte', 'Carné de Extranjería']).withMessage('Tipo de documento inválido.'),
  body('numero_documento').trim().custom((value, { req }) => {
    const tipo = req.body.tipo_documento;
    if (tipo === 'DNI' && !/^\d{8}$/.test(value)) {
      throw new Error('El DNI debe tener exactamente 8 dígitos.');
    }
    if (tipo !== 'DNI' && !/^[A-Za-z0-9]{5,15}$/.test(value)) {
      throw new Error('El número de documento debe tener entre 5 y 15 caracteres alfanuméricos.');
    }
    return true;
  }),
  body('nombres').trim().notEmpty().withMessage('Los nombres son obligatorios.').isLength({ max: 80 }),
  body('apellidos').trim().notEmpty().withMessage('Los apellidos son obligatorios.').isLength({ max: 80 }),
  body('nacionalidad').trim().notEmpty().withMessage('La nacionalidad es obligatoria.').isLength({ max: 40 }),
  body(['procedencia', 'destino', 'motivo_viaje']).optional({ values: 'falsy' }).trim().isLength({ max: 80 }).withMessage('Texto demasiado largo (máx. 80 caracteres).'),
  body('telefono').optional({ values: 'falsy' }).trim().isLength({ max: 20 }).withMessage('Teléfono demasiado largo.'),
  body('fecha_nacimiento').optional({ values: 'falsy' }).isISO8601({ strict: true }).withMessage('Fecha de nacimiento inválida.'),
  body('noches').isInt({ min: 1, max: 365 }).withMessage('El número de noches debe estar entre 1 y 365.'),
];

router.post('/:id/checkin', requireRole('admin', 'recepcion'), checkinValidators, validate, ctrl.checkin);

router.post('/:id/checkout',
  requireRole('admin', 'recepcion'),
  [
    ...validarCobro,
    body('noches_finales').optional({ values: 'falsy' }).isInt({ min: 1, max: 365 }).withMessage('Cantidad a cobrar inválida.'),
  ],
  validate,
  ctrl.checkout
);

module.exports = router;
