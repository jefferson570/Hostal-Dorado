/**
 * middleware/errorHandler.js
 * Express reconoce este middleware como "manejador de errores" porque
 * tiene 4 parámetros (err, req, res, next). Si cualquier controlador
 * llama a next(error) o lanza una excepción, termina aquí en vez de
 * tumbar el servidor o filtrar detalles internos al navegador.
 */
function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  console.error('✖ Error no controlado:', err);
  const status = err.status || 500;
  res.status(status).json({
    error: status === 500 ? 'Ocurrió un error inesperado en el servidor.' : err.message,
  });
}

module.exports = errorHandler;
