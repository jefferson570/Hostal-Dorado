const express = require('express');
const { body } = require('express-validator');
const rateLimit = require('express-rate-limit');
const validate = require('../middleware/validate');
const { requireAuth } = require('../middleware/auth');
const ctrl = require('../controllers/auth.controller');

const router = express.Router();

/**
 * Limitar intentos de login es una práctica básica de seguridad:
 * sin esto, cualquiera podría probar miles de contraseñas por
 * segundo contra tu servidor ("fuerza bruta"). Aquí permitimos
 * 10 intentos cada 15 minutos por dirección IP.
 */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Demasiados intentos de inicio de sesión. Intenta de nuevo en unos minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // solo cuentan los intentos fallidos
});

router.post('/login',
  loginLimiter,
  [
    body('username').trim().notEmpty().isLength({ max: 30 }).withMessage('El usuario es obligatorio.'),
    body('password').isString().notEmpty().isLength({ max: 128 }).withMessage('La contraseña es obligatoria.'),
    body('role').isIn(['admin', 'recepcion']).withMessage('Rol inválido.'),
  ],
  validate,
  ctrl.login
);

router.get('/me', requireAuth, ctrl.me);

router.patch('/me',
  requireAuth,
  [
    body('nombre').optional().trim().isLength({ min: 2, max: 60 }).withMessage('El nombre debe tener entre 2 y 60 caracteres.'),
    body('username').optional().trim().isLength({ min: 3, max: 30 }).withMessage('El usuario debe tener entre 3 y 30 caracteres.')
      .matches(/^[a-zA-Z0-9._-]+$/).withMessage('El usuario solo puede tener letras, números, puntos, guiones y guion bajo.'),
    body('foto').optional({ values: 'falsy' }).isString().withMessage('Foto inválida.'),
    body('password_nueva').optional({ values: 'falsy' }).isLength({ min: 8, max: 128 }).withMessage('La nueva contraseña debe tener entre 8 y 128 caracteres.'),
    body('password_actual').optional({ values: 'falsy' }).isString(),
  ],
  validate,
  ctrl.updateMe
);

module.exports = router;
