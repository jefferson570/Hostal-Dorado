const express = require('express');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { requireAuth, requireRole } = require('../middleware/auth');
const ctrl = require('../controllers/inventory.controller');

const router = express.Router();
router.use(requireAuth);

router.get('/', ctrl.list);
router.get('/ganancias', ctrl.ganancias);

router.post('/',
  requireRole('admin'),
  [
    body('nombre').trim().notEmpty().withMessage('El nombre del producto es obligatorio.'),
    body('precio').isFloat({ gt: 0 }).withMessage('El precio debe ser mayor a 0.'),
    body('costo').optional().isFloat({ min: 0 }).withMessage('El costo no puede ser negativo.'),
    body('stock').optional().isInt({ min: 0 }).withMessage('El stock inicial no puede ser negativo.'),
  ],
  validate,
  ctrl.create
);

router.patch('/:id', requireRole('admin'), ctrl.update);
router.delete('/:id', requireRole('admin'), ctrl.remove);

router.post('/:id/sell',
  requireRole('admin', 'recepcion'),
  [ body('cantidad').isInt({ min: 1 }).withMessage('La cantidad debe ser al menos 1.') ],
  validate,
  ctrl.sell
);

router.post('/:id/adjust',
  requireRole('admin'),
  [ body('delta').isInt().withMessage('El ajuste debe ser un número entero.') ],
  validate,
  ctrl.adjust
);

module.exports = router;
