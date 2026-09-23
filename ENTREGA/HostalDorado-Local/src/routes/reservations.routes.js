/**
 * routes/reservations.routes.js
 * ---------------------------------------------------------------
 * Rutas PROTEGIDAS del panel para gestionar pre-reservas. Aquí sí
 * van requireAuth + rol (a diferencia de /api/public). La persona
 * que hace la pre-reserva nunca puede confirmarse a sí misma: eso
 * lo decide el staff desde el panel.
 */
const express = require('express');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { requireAuth, requireRole } = require('../middleware/auth');
const ctrl = require('../controllers/reservations.controller');

const router = express.Router();
router.use(requireAuth);

router.get('/', ctrl.list);

router.patch('/:id',
  requireRole('admin', 'recepcion'),
  [
    body('estado').isIn(['confirmada', 'cancelada']).withMessage('Solo puedes confirmar o cancelar una pre-reserva.'),
  ],
  validate,
  ctrl.setEstado
);

module.exports = router;