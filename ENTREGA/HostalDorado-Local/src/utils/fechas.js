/**
 * utils/fechas.js
 * ---------------------------------------------------------------
 * "Hoy" SIEMPRE en la hora del hostal (America/Lima, fijada en
 * config.js), nunca en UTC. Con toISOString() el servidor creía que
 * a partir de las 7 p. m. de Perú ya era el día siguiente: rechazaba
 * reservas de "hoy" y anotaba las ventas nocturnas con fecha de mañana.
 */
const pad = n => String(n).padStart(2, '0');

/** Fecha local AAAA-MM-DD (opcionalmente desplazada n días). */
function hoy(offsetDias = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDias);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

module.exports = { hoy };
