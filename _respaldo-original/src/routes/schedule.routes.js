const express = require('express');
const { requireAuth } = require('../middleware/auth');
const ctrl = require('../controllers/schedule.controller');

const router = express.Router();

router.get('/', requireAuth, ctrl.schedule);

module.exports = router;