/**
 * routes/public.routes.js
 * ---------------------------------------------------------------
 * La frontera PÚBLICA de la API. Aquí NO hay requireAuth ni rol:
 * es de adrede — el sitio público no pide login. Para que esto sea
 * seguro solo se monta lo mínimo indispensable y se valida + limita
 * cada petición. Toda la lógica está en public.controller.js.
 */
const express = require('express');
const { body } = require('express-validator');
const rateLimit = require('express-rate-limit');
const validate = require('../middleware/validate');
const ctrl = require('../controllers/public.controller');

const router = express.Router();

const { hoy } = require('../utils/fechas');
const todayStr = () => hoy();
const maxDateStr = () => hoy(365);

// Límites propios del sitio público (además del que ya protege el login).
const availabilityLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120,
  message: { error: 'Demasiadas consultas de disponibilidad. Espera unos minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const reservationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30,
  message: { error: 'Has hecho demasiadas pre-reservas. Intenta más tarde.' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.get('/rooms-availability', availabilityLimiter, ctrl.availability);
router.get('/tarifario', availabilityLimiter, ctrl.tarifario);

router.post('/reservations',
  reservationLimiter,
  [
    body('tipo_habitacion').trim().notEmpty().withMessage('El tipo de habitación es obligatorio.').isLength({ max: 40 }),
    body('checkin').isISO8601({ strict: true }).withMessage('La fecha de entrada es inválida.')
      .custom(v => v >= todayStr()).withMessage('La fecha de entrada no puede ser anterior a hoy.')
      .custom(v => v <= maxDateStr()).withMessage('Solo aceptamos pre-reservas hasta con un año de anticipación.'),
    body('hora_ingreso').isInt({ min: 0, max: 23 }).withMessage('Elige una hora de ingreso válida (0 a 23).'),
    body('nombre').trim().notEmpty().withMessage('Indica tu nombre para la pre-reserva.')
      .isLength({ min: 3, max: 80 }).withMessage('Tu nombre debe tener entre 3 y 80 caracteres.'),
    body('telefono').optional({ values: 'falsy' }).trim().isLength({ max: 30 }).withMessage('Teléfono demasiado largo.'),
    body('email').optional({ values: 'falsy' }).trim().isEmail().isLength({ max: 120 }).withMessage('Revisa el correo electrónico.'),
    // Al menos un medio de contacto: sin él el hostal no puede confirmar la reserva.
    body('telefono').custom((v, { req }) => !!(String(v || '').trim() || String(req.body.email || '').trim()))
      .withMessage('Déjanos un teléfono o un correo para poder confirmarte.'),
  ],
  validate,
  ctrl.createReservation
);

module.exports = router;