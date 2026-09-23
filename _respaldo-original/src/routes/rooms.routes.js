const express = require('express');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { requireAuth, requireRole } = require('../middleware/auth');
const ctrl = require('../controllers/rooms.controller');

const router = express.Router();

router.use(requireAuth); // todas las rutas de habitaciones requieren sesión iniciada

router.get('/', ctrl.list);

router.post('/',
  requireRole('admin'),
  [
    body('numero').trim().notEmpty().withMessage('El número de habitación es obligatorio.'),
    body('tipo').trim().notEmpty().withMessage('El tipo de habitación es obligatorio.'),
    body('precio').isFloat({ gt: 0 }).withMessage('El precio debe ser mayor a 0.'),
  ],
  validate,
  ctrl.create
);

router.patch('/:id',
  requireRole('admin', 'recepcion'),
  [
    body('estado').optional().isIn(['libre', 'limpieza', 'mantenimiento']).withMessage('Estado inválido.'),
    body('precio').optional().isFloat({ gt: 0 }).withMessage('El precio debe ser mayor a 0.'),
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
  body('nombres').trim().notEmpty().withMessage('Los nombres son obligatorios.'),
  body('apellidos').trim().notEmpty().withMessage('Los apellidos son obligatorios.'),
  body('nacionalidad').trim().notEmpty().withMessage('La nacionalidad es obligatoria.'),
  body('noches').isInt({ min: 1 }).withMessage('El número de noches debe ser al menos 1.'),
];

router.post('/:id/checkin', requireRole('admin', 'recepcion'), checkinValidators, validate, ctrl.checkin);

router.post('/:id/checkout',
  requireRole('admin', 'recepcion'),
  [ body('metodo_pago').trim().notEmpty().withMessage('Selecciona un método de pago.') ],
  validate,
  ctrl.checkout
);

module.exports = router;
