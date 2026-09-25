/**
 * routes/employees.routes.js
 * ---------------------------------------------------------------
 * "Control de empleados" — ver el historial lo pueden hacer admin y
 * recepción (transparencia del equipo), pero solo el administrador
 * registra o borra jornadas de limpieza.
 */
const express = require('express');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { requireAuth, requireRole } = require('../middleware/auth');
const ctrl = require('../controllers/employees.controller');

const router = express.Router();
router.use(requireAuth);

router.get('/logs', ctrl.list);
router.get('/summary', ctrl.summary);

router.post('/logs',
  requireRole('admin'),
  [
    body('empleado').trim().notEmpty().withMessage('Indica el nombre del colaborador.')
      .isLength({ max: 60 }).withMessage('Nombre demasiado largo (máx. 60 caracteres).'),
    body('habitaciones').isInt({ min: 0, max: 200 }).withMessage('Las habitaciones limpiadas deben ser un número igual o mayor a 0.'),
    body('fecha').optional({ values: 'falsy' }).isISO8601({ strict: true }).withMessage('Fecha inválida.'),
    body('hora_ingreso').optional({ values: 'falsy' }).matches(/^([01]\d|2[0-3]):([0-5]\d)$/).withMessage('Hora de ingreso inválida (HH:MM).'),
    body('hora_salida').optional({ values: 'falsy' }).matches(/^([01]\d|2[0-3]):([0-5]\d)$/).withMessage('Hora de salida inválida (HH:MM).'),
  ],
  validate,
  ctrl.create
);

router.delete('/logs/:id', requireRole('admin'), ctrl.remove);

module.exports = router;
