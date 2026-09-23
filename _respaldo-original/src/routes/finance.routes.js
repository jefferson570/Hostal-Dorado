const express = require('express');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { requireAuth, requireRole } = require('../middleware/auth');
const ctrl = require('../controllers/finance.controller');

const router = express.Router();
router.use(requireAuth);

router.get('/', ctrl.list);
router.get('/summary', ctrl.summary);

router.post('/',
  requireRole('admin'), // solo el administrador registra movimientos manuales
  [
    body('concepto').trim().notEmpty().withMessage('El concepto es obligatorio.'),
    body('tipo').isIn(['ingreso', 'egreso']).withMessage('Tipo inválido.'),
    body('monto').isFloat({ gt: 0 }).withMessage('El monto debe ser mayor a 0.'),
    body('metodo').trim().notEmpty().withMessage('El método de pago es obligatorio.'),
  ],
  validate,
  ctrl.create
);

module.exports = router;
