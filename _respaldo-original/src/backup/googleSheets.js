/**
 * backup/googleSheets.js
 * ---------------------------------------------------------------
 * Respaldo automático a una Hoja de cálculo de Google (Google
 * Sheets): cada vez que se registra un huésped, un movimiento de
 * finanzas o una venta, se agrega una FILA NUEVA a la hoja
 * correspondiente — como una copia en vivo, fuera del servidor,
 * de todo lo que se va guardando.
 *
 * Por qué Google Sheets y no "conectar a Excel" directamente:
 * un archivo .xlsx no vive en internet por sí solo, así que no hay
 * forma de que el servidor lo edite en tiempo real desde otra
 * computadora. Google Sheets sí es una hoja de cálculo real que
 * vive en la nube: se ve y edita como Excel, pero el servidor puede
 * escribirle filas automáticamente a través de la API de Google.
 * El respaldo manual en Excel (botón "Exportar Excel") sigue
 * existiendo tal cual — esto es ADEMÁS, no en reemplazo.
 *
 * CONFIGURACIÓN (ver GOOGLE_SHEETS_SETUP.md en la raíz del proyecto
 * para la guía paso a paso):
 *   GOOGLE_SHEETS_ENABLED=true
 *   GOOGLE_SERVICE_ACCOUNT_KEY_PATH=./google-service-account.json
 *   GOOGLE_SHEET_ID=el-id-de-tu-hoja-de-calculo
 *
 * Si estas variables no están configuradas, este módulo simplemente
 * no hace nada (el sistema funciona exactamente igual sin él) — así
 * nadie se queda bloqueado por no tener todavía la cuenta de Google
 * lista.
 */
const fs = require('fs');
const path = require('path');

let sheetsClient = null;
let habilitado = false;
let spreadsheetId = null;
let inicializando = null;

function habilitadoConfig() {
  return String(process.env.GOOGLE_SHEETS_ENABLED || '').toLowerCase() === 'true'
    && !!process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH
    && !!process.env.GOOGLE_SHEET_ID;
}

/** Se conecta una sola vez (perezoso: la primera vez que se necesita). */
async function conectar() {
  if (!habilitadoConfig()) return null;
  if (sheetsClient) return sheetsClient;
  if (inicializando) return inicializando;

  inicializando = (async () => {
    try {
      const { google } = require('googleapis'); // require perezoso: si no está instalado y no se usa, no rompe nada
      const keyPath = path.resolve(process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH);
      if (!fs.existsSync(keyPath)) {
        console.warn(`⚠ Respaldo a Google Sheets: no se encontró el archivo de credenciales en ${keyPath}. El respaldo automático queda desactivado.`);
        return null;
      }
      const auth = new google.auth.GoogleAuth({
        keyFile: keyPath,
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      });
      sheetsClient = google.sheets({ version: 'v4', auth });
      spreadsheetId = process.env.GOOGLE_SHEET_ID;
      habilitado = true;
      console.log('✔ Respaldo automático a Google Sheets activado.');
      return sheetsClient;
    } catch (err) {
      console.warn('⚠ No se pudo activar el respaldo a Google Sheets:', err.message);
      return null;
    }
  })();

  return inicializando;
}

/**
 * Agrega una fila al final de una hoja (pestaña) dentro del
 * spreadsheet configurado. Si la pestaña no existe, Google Sheets
 * devuelve un error claro — hay que crearla una vez con ese nombre
 * exacto (ver GOOGLE_SHEETS_SETUP.md).
 *
 * NUNCA se espera (await) desde quien llama en el flujo principal:
 * si Google está lento o caído, el check-in / la venta / el
 * movimiento de caja NO deben demorarse ni fallar por eso. Los
 * errores solo se registran en consola.
 */
async function appendRow(sheetName, values) {
  try {
    const client = await conectar();
    if (!client) return; // no configurado: no-op silencioso
    await client.spreadsheets.values.append({
      spreadsheetId,
      range: `${sheetName}!A1`,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: [values] },
    });
  } catch (err) {
    console.warn(`⚠ No se pudo respaldar en Google Sheets (hoja "${sheetName}"):`, err.message);
  }
}

module.exports = { appendRow, habilitadoConfig };
