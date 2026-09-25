/**
 * api.js
 * ---------------------------------------------------------------
 * Todo el frontend pasa por esta única función para hablar con el
 * backend. Centralizar esto significa que solo hay UN lugar que
 * sabe cómo se añade el token, cómo se leen los errores, y qué
 * pasa si la sesión expiró — el resto del código solo dice
 * "api('/rooms')" y no piensa en HTTP para nada más.
 */
const TOKEN_KEY = 'dorado_token';
const USER_KEY = 'dorado_user';
const EXPIRED_KEY = 'dorado_session_expired';

function getToken() { try { return localStorage.getItem(TOKEN_KEY); } catch (_) { return null; } }
function getUser() {
  try { return JSON.parse(localStorage.getItem(USER_KEY)); } catch (e) { return null; }
}
function setSession(token, user) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}
function clearSession() {
  try { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USER_KEY); } catch (_) { /* almacenamiento bloqueado */ }
}

/* Botón que disparó la última acción: mientras su petición está en curso
   queda bloqueado con un indicador de carga. Esto evita los dobles clics
   (antes un clic ansioso en "Eliminar" mandaba la misma orden 7 veces). */
let lastClicked = null;
document.addEventListener('click', e => {
  const btn = e.target.closest('button, .btn');
  lastClicked = btn ? { el: btn, at: Date.now() } : null;
}, true);

let sessionExpiring = false;

async function api(path, { method = 'GET', body, timeout = 20000 } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers.Authorization = 'Bearer ' + token;

  const mutating = method !== 'GET';
  const btn = mutating && lastClicked && Date.now() - lastClicked.at < 800 ? lastClicked.el : null;
  if (btn) {
    if (btn.classList.contains('is-busy')) throw Object.assign(new Error('Procesando…'), { silent: true });
    btn.classList.add('is-busy');
    btn.setAttribute('aria-busy', 'true');
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  let res;
  try {
    res = await fetch('/api' + path, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
    });
  } catch (err) {
    throw new Error(err.name === 'AbortError'
      ? 'El servidor tardó demasiado en responder. Revisa tu conexión e inténtalo de nuevo.'
      : 'No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo.');
  } finally {
    clearTimeout(timer);
    if (btn) { btn.classList.remove('is-busy'); btn.removeAttribute('aria-busy'); }
  }

  // Si el token expiró o ya no es válido, volvemos al login una sola vez
  // (y avisamos el motivo) en vez de mostrar una app rota.
  if (res.status === 401 && path !== '/auth/login') {
    if (!sessionExpiring) {
      sessionExpiring = true;
      clearSession();
      try { sessionStorage.setItem(EXPIRED_KEY, '1'); } catch (_) { /* sin storage */ }
      location.reload();
    }
    throw Object.assign(new Error('Tu sesión expiró.'), { silent: true });
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || 'Ocurrió un error inesperado.');
    err.status = res.status;
    err.detalles = data.detalles;
    // Si hay detalles de validación, el primero suele ser el más útil.
    if (data.detalles && data.detalles.length && data.error === 'Revisa los datos ingresados.') {
      err.message = data.detalles[0].mensaje;
    }
    throw err;
  }
  return data;
}
