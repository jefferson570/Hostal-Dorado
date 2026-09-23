/**
 * middleware/errorHandler.js
 * Express reconoce este middleware como "manejador de errores" porque
 * tiene 4 parámetros (err, req, res, next). Si cualquier controlador
 * lanza una excepción, termina aquí en vez de tumbar el servidor o
 * filtrar detalles internos al navegador.
 *
 * Los errores conocidos (JSON mal formado, cuerpo demasiado grande,
 * restricciones de la base de datos) se traducen a un mensaje claro
 * en español con su código HTTP correcto; el resto es un 500 genérico.
 */
function traducir(err) {
  if (err.type === 'entity.parse.failed') return { status: 400, error: 'La petición tiene un formato inválido.' };
  if (err.type === 'entity.too.large') return { status: 413, error: 'Los datos enviados son demasiado grandes.' };

  const code = String(err.code || '');
  if (code === 'SQLITE_CONSTRAINT_FOREIGNKEY') {
    return { status: 409, error: 'No se pudo completar: el registro está vinculado a otros datos (o tu sesión quedó desactualizada). Recarga la página e inténtalo de nuevo.' };
  }
  if (code === 'SQLITE_CONSTRAINT_UNIQUE' || code === 'SQLITE_CONSTRAINT_PRIMARYKEY') {
    return { status: 409, error: 'Ya existe un registro con esos datos.' };
  }
  if (code === 'SQLITE_CONSTRAINT_CHECK' || code === 'SQLITE_CONSTRAINT_NOTNULL') {
    return { status: 400, error: 'Alguno de los datos no es válido. Revisa el formulario.' };
  }
  if (code === 'SQLITE_BUSY') return { status: 503, error: 'El sistema está ocupado, intenta de nuevo en unos segundos.' };

  const status = err.status || err.statusCode || 500;
  return { status, error: status >= 500 ? 'Ocurrió un error inesperado en el servidor.' : err.message };
}

function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  const { status, error } = traducir(err);
  if (status >= 500) console.error(`✖ Error no controlado en ${req.method} ${req.originalUrl}:`, err);
  else if (String(err.code || '').startsWith('SQLITE_')) console.warn(`⚠ ${req.method} ${req.originalUrl}: ${err.code}`);
  if (res.headersSent) return next(err);
  res.status(status).json({ error });
}

module.exports = errorHandler;
