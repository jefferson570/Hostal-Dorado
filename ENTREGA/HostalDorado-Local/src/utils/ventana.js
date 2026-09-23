/**
 * utils/ventana.js
 * ---------------------------------------------------------------
 * El modelo de ocupación del hostal: cada reserva ocupa una habitación
 * por bloques de 12 horas contadas desde la hora de ingreso elegida
 * por el cliente en /sitio. `ventana(fecha, hora)` devuelve el ISO de
 * inicio y fin (12 h después) de ese bloque. Todo el sistema (sitio,
 * panel, cronograma) deriva de aquí.
 */
const pad = n => String(n).padStart(2, '0');

function ventana(checkin, horaIngreso) {
  const h = Math.max(0, Math.min(23, Number(horaIngreso) || 0));
  const inicio = new Date(`${checkin}T${pad(h)}:00:00`);
  return {
    inicio: inicio.toISOString(),
    fin: new Date(inicio.getTime() + 12 * 3600000).toISOString(),
  };
}

/** ¿Se solapan dos ventanas [a1,a2) y [b1,b2)? (comparación lexicográfica ISO). */
const solapan = (a1, a2, b1, b2) => a1 < b2 && b1 < a2;

const ahora = () => new Date().toISOString();

module.exports = { ventana, solapan, ahora };