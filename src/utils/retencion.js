/**
 * utils/retencion.js
 * ---------------------------------------------------------------
 * Minimización de datos (Ley 29733 de Protección de Datos Personales).
 * Los datos de contacto que un cliente deja en una PRE-RESERVA del sitio
 * web solo sirven para confirmar esa llegada. Pasado el plazo de
 * retención se anonimizan: el registro se conserva para las estadísticas
 * y el cronograma, pero sin nombre, teléfono ni correo.
 *
 * No toca el registro de huéspedes (tabla guests/stays): ese registro lo
 * exige la normativa de hospedaje y se rige por sus propios plazos.
 */
const { hoy } = require('./fechas');

const DIAS_RETENCION = 90;

function anonimizar(db) {
  const limite = hoy(-DIAS_RETENCION);
  const r = db.prepare(`
    UPDATE reservations
       SET nombre = 'Datos eliminados', telefono = NULL, email = NULL
     WHERE checkout < ? AND nombre <> 'Datos eliminados'
  `).run(limite);
  if (r.changes) console.log(`🧹 ${r.changes} pre-reserva(s) antiguas anonimizadas (más de ${DIAS_RETENCION} días).`);
}

/** Al arrancar y luego una vez al día. */
function iniciar(db) {
  const correr = () => { try { anonimizar(db); } catch (err) { console.warn('⚠ Retención de datos:', err.message); } };
  setTimeout(correr, 30 * 1000).unref();
  setInterval(correr, 24 * 60 * 60 * 1000).unref();
}

module.exports = { iniciar, anonimizar, DIAS_RETENCION };
