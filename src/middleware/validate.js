/**
 * middleware/validate.js
 * Se coloca después de las reglas de express-validator en una ruta.
 * Si alguna regla falló, corta la petición aquí con un mensaje claro
 * en español, en vez de dejar que llegue código a medio validar
 * hasta la base de datos.
 */
const { validationResult } = require('express-validator');

function validate(req, res, next) {
  const result = validationResult(req);
  if (!result.isEmpty()) {
    return res.status(400).json({
      error: 'Revisa los datos ingresados.',
      detalles: result.array().map(e => ({ campo: e.path, mensaje: e.msg })),
    });
  }
  next();
}

module.exports = validate;
