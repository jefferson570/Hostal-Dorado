/**
 * backup/autoBackup.js
 * ---------------------------------------------------------------
 * Respaldo automático DIARIO de la base de datos, pensado sobre todo
 * para la instalación local en la PC de recepción: si el disco falla
 * o alguien borra algo por error, siempre hay copias de los últimos
 * días en data/respaldos/ (una por día: hostal-AAAA-MM-DD.db).
 *
 * Usa la API de respaldo "en caliente" de SQLite (db.backup): copia
 * la base mientras el sistema sigue funcionando, sin cortar a nadie.
 * Para mayor seguridad, apunta BACKUP_DIR a una carpeta sincronizada
 * con Google Drive / OneDrive o a un USB.
 */
const fs = require('fs');
const path = require('path');
const config = require('../config');
const { hoy } = require('../utils/fechas');

const dir = path.resolve(config.backupDir);

async function respaldar(db) {
  try {
    fs.mkdirSync(dir, { recursive: true });
    const destino = path.join(dir, `hostal-${hoy()}.db`);
    await db.backup(destino);

    // Conserva solo los últimos N respaldos.
    const archivos = fs.readdirSync(dir)
      .filter(f => /^hostal-\d{4}-\d{2}-\d{2}\.db$/.test(f))
      .sort();
    for (const viejo of archivos.slice(0, Math.max(0, archivos.length - config.backupKeep))) {
      fs.unlinkSync(path.join(dir, viejo));
    }
    console.log(`💾 Respaldo automático guardado: ${destino}`);
  } catch (err) {
    console.warn('⚠ No se pudo crear el respaldo automático:', err.message);
  }
}

/** Primer respaldo al minuto de arrancar y luego cada 6 horas (se sobrescribe el del día). */
function iniciar(db) {
  setTimeout(() => respaldar(db), 60 * 1000).unref();
  setInterval(() => respaldar(db), 6 * 60 * 60 * 1000).unref();
}

module.exports = { iniciar, respaldar };
