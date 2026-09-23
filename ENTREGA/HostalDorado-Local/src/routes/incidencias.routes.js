/**
 * routes/incidencias.routes.js
 * ---------------------------------------------------------------
 * Rutas PROTEGIDAS del panel para las incidencias. Verlas y
 * registrarlas lo pueden hacer admin y recepción, siempre con sesión.
 */
const express = require('express');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { requireAuth } = require('../middleware/auth');
const ctrl = require('../controllers/incidencias.controller');

const router = express.Router();
router.use(requireAuth);

router.get('/', ctrl.list);

router.post('/',
  [
    body('tipo').trim().notEmpty().withMessage('Selecciona el tipo de incidente.').isLength({ max: 60 }),
    body('ubicacion').trim().notEmpty().withMessage('Indica el lugar del hostal.').isLength({ max: 60 }),
    body('habitacion_num').optional({ values: 'falsy' }).trim().isLength({ max: 10 }),
    body('detalle').optional({ values: 'falsy' }).trim().isLength({ max: 500 }).withMessage('El detalle es demasiado largo (máx. 500 caracteres).'),
  ],
  validate,
  ctrl.create
);

router.patch('/:id',
  [body('estado').isIn(['abierta', 'en_revision', 'resuelta']).withMessage('Estado de incidencia inválido.')],
  validate,
  ctrl.setEstado
);

module.exports = router;