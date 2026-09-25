const express = require('express');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { requireAuth, requireRole } = require('../middleware/auth');
const ctrl = require('../controllers/finance.controller');
const { validarCobro } = require('../middleware/cobro');

const router = express.Router();
router.use(requireAuth);

router.get('/', ctrl.list);
router.get('/summary', ctrl.summary);

router.post('/',
  requireRole('admin', 'recepcion'), // gastos: ambos roles · ingresos manuales: solo admin (ver controlador)
  [
    body('concepto').trim().notEmpty().withMessage('El concepto es obligatorio.')
      .isLength({ max: 120 }).withMessage('El concepto es demasiado largo (máx. 120 caracteres).'),
    body('tipo').isIn(['ingreso', 'egreso']).withMessage('Tipo inválido.'),
    body('monto').isFloat({ gt: 0, max: 1000000 }).withMessage('El monto debe ser mayor a 0.'),
    ...validarCobro,
  ],
  validate,
  ctrl.create
);

module.exports = router;
