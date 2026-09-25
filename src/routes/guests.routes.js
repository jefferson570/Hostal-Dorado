const express = require('express');
const { requireAuth } = require('../middleware/auth');
const ctrl = require('../controllers/guests.controller');

const router = express.Router();
router.use(requireAuth);

router.get('/', ctrl.list);
router.get('/:id/history', ctrl.history);

module.exports = router;
