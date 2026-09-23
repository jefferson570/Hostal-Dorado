/**
 * routes/notas.routes.js
 * ---------------------------------------------------------------
 * Rutas PROTEGIDAS del panel para las notas internas. Verlas y
 * crearlas lo pueden hacer admin y recepción, siempre con sesión.
 */
const express = require('express');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { requireAuth } = require('../middleware/auth');
const ctrl = require('../controllers/notas.controller');

const router = express.Router();
router.use(requireAuth);

router.get('/', ctrl.list);

router.post('/',
  [body('texto').trim().notEmpty().withMessage('El texto de la nota es obligatorio.')],
  validate,
  ctrl.create
);

module.exports = router;