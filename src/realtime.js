/**
 * realtime.js
 * ---------------------------------------------------------------
 * Guarda la instancia de Socket.io en un solo lugar para que
 * cualquier controlador pueda "avisar" a todos los navegadores
 * conectados que algo cambió, sin tener que pasarse el objeto `io`
 * de función en función.
 *
 * Esto es lo que hace que el sistema sea de verdad en tiempo real:
 * si el recepcionista vende un producto desde su computadora, el
 * dashboard del administrador —abierto en otro dispositivo, en otra
 * red— se actualiza solo, sin recargar la página.
 */
let io = null;

function init(serverIo) {
  io = serverIo;
}

/**
 * Emite un evento a todos los clientes conectados.
 * @param {string} event  nombre del evento, ej. 'rooms:changed'
 * @param {object} payload información opcional sobre el cambio
 */
function broadcast(event, payload = {}) {
  if (!io) return;
  io.emit(event, payload);
}

module.exports = { init, broadcast };
