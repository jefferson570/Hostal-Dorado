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

function getToken() { return localStorage.getItem(TOKEN_KEY); }
function getUser() {
  try { return JSON.parse(localStorage.getItem(USER_KEY)); } catch (e) { return null; }
}
function setSession(token, user) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}
function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

async function api(path, { method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers.Authorization = 'Bearer ' + token;

  const res = await fetch('/api' + path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  // Si el token expiró o es inválido, el backend responde 401:
  // devolvemos a la persona al login en vez de mostrar una app rota.
  if (res.status === 401 && path !== '/auth/login') {
    clearSession();
    location.reload();
    throw new Error('Sesión expirada');
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || 'Ocurrió un error inesperado.');
    err.detalles = data.detalles;
    throw err;
  }
  return data;
}
