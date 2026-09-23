/**
 * ids.js
 * Node incluye generación de UUID nativa desde la versión 14.17+
 * (módulo `crypto`), así que no necesitamos instalar ninguna
 * librería extra solo para generar identificadores únicos.
 */
const crypto = require('crypto');

function newId() {
  return crypto.randomUUID();
}

module.exports = { newId };
