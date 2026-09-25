const express = require('express');
const { body, param } = require('express-validator');
const validate = require('../middleware/validate');
const { requireAuth, requireRole } = require('../middleware/auth');
const ctrl = require('../controllers/inventory.controller');
const { validarCobro } = require('../middleware/cobro');

const router = express.Router();
router.use(requireAuth);

const idParam = param('id').isUUID().withMessage('Producto inválido.');

router.get('/', ctrl.list);
router.get('/ganancias', ctrl.ganancias);

router.post('/',
  requireRole('admin'),
  [
    body('nombre').trim().notEmpty().withMessage('El nombre del producto es obligatorio.')
      .isLength({ max: 80 }).withMessage('El nombre es demasiado largo (máx. 80 caracteres).'),
    body('categoria').optional({ values: 'falsy' }).trim().isLength({ max: 40 }).withMessage('La categoría es demasiado larga.'),
    body('precio').isFloat({ gt: 0, max: 100000 }).withMessage('El precio debe ser mayor a 0.'),
    body('costo').optional().isFloat({ min: 0, max: 100000 }).withMessage('El costo no puede ser negativo.'),
    body('stock').optional().isInt({ min: 0, max: 100000 }).withMessage('El stock inicial no puede ser negativo.'),
    body('stock_minimo').optional().isInt({ min: 0, max: 100000 }).withMessage('El stock mínimo no puede ser negativo.'),
  ],
  validate,
  ctrl.create
);

router.patch('/:id',
  requireRole('admin'),
  [
    idParam,
    body('nombre').optional().trim().notEmpty().isLength({ max: 80 }).withMessage('Nombre inválido.'),
    body('categoria').optional({ values: 'null' }).trim().isLength({ max: 40 }).withMessage('Categoría inválida.'),
    body('precio').optional().isFloat({ gt: 0, max: 100000 }).withMessage('El precio debe ser mayor a 0.'),
    body('costo').optional().isFloat({ min: 0, max: 100000 }).withMessage('El costo no puede ser negativo.'),
    body('stock_minimo').optional().isInt({ min: 0, max: 100000 }).withMessage('El stock mínimo no puede ser negativo.'),
  ],
  validate,
  ctrl.update
);

router.delete('/:id', requireRole('admin'), [idParam], validate, ctrl.remove);

router.post('/:id/sell',
  requireRole('admin', 'recepcion'),
  [
    idParam,
    body('cantidad').isInt({ min: 1, max: 1000 }).withMessage('La cantidad debe ser al menos 1.'),
    ...validarCobro,
  ],
  validate,
  ctrl.sell
);

router.post('/:id/adjust',
  requireRole('admin'),
  [
    idParam,
    body('delta').isInt({ min: -100000, max: 100000 }).withMessage('El ajuste debe ser un número entero.'),
    body('motivo').optional().trim().isLength({ max: 200 }),
  ],
  validate,
  ctrl.adjust
);

module.exports = router;
