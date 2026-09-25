const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const ctrl = require('../controllers/export.controller');

const router = express.Router();
router.use(requireAuth);

// Ambos roles pueden exportar el reporte de Excel (es lo mismo que ya pueden ver en pantalla).
router.get('/reporte', ctrl.reporte);

// Solo el administrador puede descargar el respaldo crudo de la base de datos.
router.get('/backup', requireRole('admin'), ctrl.backup);

module.exports = router;
