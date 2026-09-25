/**
 * app.js
 * ---------------------------------------------------------------
 * Este archivo NO tiene ninguna base de datos ni lógica de negocio:
 * solo pinta pantallas y llama a la API (ver api.js). Toda la
 * verdad (stock real, dinero real, quién puede hacer qué) vive en
 * el servidor. Esto es a propósito: nunca confíes en el navegador
 * para decidir cosas importantes, porque cualquiera puede abrir la
 * consola y cambiar el HTML. El servidor vuelve a validar todo.
 */
const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));

const money = n => 'S/ ' + Number(n || 0).toFixed(2);
// Fecha LOCAL (no UTC): después de las 7 p. m. en Perú, UTC ya es "mañana".
const isoLocal = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const todayISO = () => isoLocal(new Date());
function escapeHTML(s){ return String(s ?? '').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function fmtDate(iso){ const d = new Date(iso+'T12:00:00'); return d.toLocaleDateString('es-PE',{day:'2-digit',month:'short'}); }
/* Fecha + hora para ventanas de 12 h. Acepta 'YYYY-MM-DD' (día completo)
   o ISO con tiempo ('...T18:00:00.000Z'), devolviendo "18 sep · 18:00". */
function fmtDT(isoS){
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(isoS || '');
  const d = new Date(dateOnly ? isoS + 'T00:00:00' : isoS);
  if (isNaN(d)) return isoS || '';
  const fecha = d.toLocaleDateString('es-PE',{day:'2-digit',month:'short'});
  return dateOnly ? fecha : `${fecha} · ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

/* ============================================================
   ICONOS — Lucide (SVG inline, outline). Una sola fuente de verdad:
   los <span data-icon="..."> del HTML se rellenan aquí, y todo
   contenido dinámico usa icon(nombre). Trazo y tamaño uniformes.
   ============================================================ */
const ICONS = {
  resumen:'<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
  habitaciones:'<path d="M2 20v-8a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v8"/><path d="M4 10V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4"/><path d="M12 4v6"/><path d="M2 18h20"/>',
  huespedes:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  finanzas:'<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>',
  reservas:'<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
  inventario:'<path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>',
  respaldo:'<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14a9 3 0 0 0 18 0V5"/><path d="M3 12a9 3 0 0 0 18 0"/>',
  salir:'<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>',
  excel:'<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M12 18v-6"/><path d="m9 15 3 3 3-3"/>',
  ingreso:'<path d="M16 16h6"/><path d="M19 13v6"/><path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l2-1.14"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>',
  gasto:'<polyline points="22 17 13.5 8.5 8.5 13.5 2 7"/><polyline points="16 17 22 17 22 11"/>',
  venta:'<circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/>',
  incidencia:'<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  pedido:'<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/>',
  nota:'<path d="M15.5 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8.5L15.5 3Z"/><path d="M15 3v6h6"/>',
  wallet:'<path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h4"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/>',
  ojo:'<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
  ojoOff:'<path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.53 13.53 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" y1="2" x2="22" y2="22"/>',
  candado:'<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  menu:'<line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/>',
  equipo:'<path d="M18 21a8 8 0 0 0-16 0"/><circle cx="10" cy="8" r="5"/><path d="M22 20c0-3.37-2-6.5-4-8a5 5 0 0 0-.45-8.3"/>',
  ajustes:'<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
  check:'<polyline points="20 6 9 17 4 12"/>',
  cerrar:'<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
  info:'<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>',
  basura:'<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>',
  llave:'<circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6"/><path d="m15.5 7.5 3 3L22 7l-3-3"/>',
  escudo:'<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>',
  caja:'<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/><path d="M2 13h20"/><path d="M10 13v2h4v-2"/>',
  recibo:'<path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 17.5v-11"/>',
  imprimir:'<polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
  mas:'<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
  editar:'<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  efectivo:'<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/>',
  celular:'<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M12 18h.01"/>',
  tarjeta:'<rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>',
  banco:'<line x1="3" y1="22" x2="21" y2="22"/><line x1="6" y1="18" x2="6" y2="11"/><line x1="10" y1="18" x2="10" y2="11"/><line x1="14" y1="18" x2="14" y2="11"/><line x1="18" y1="18" x2="18" y2="11"/><polygon points="12 2 20 7 4 7"/>',
  mixto:'<path d="M16 3h5v5"/><path d="M8 3H3v5"/><path d="M12 22v-8.3a4 4 0 0 0-1.172-2.872L3 3"/><path d="m15 9 6-6"/>',
};

function icon(name, size = 18){
  return `<svg class="ic-svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]||''}</svg>`;
}
// Rellena los placeholders estáticos del HTML (<span data-icon="...">). Si el
// elemento ya tiene texto (p. ej. un botón), el ícono se antepone sin borrarlo.
$$('[data-icon]').forEach(el => {
  const svg = icon(el.dataset.icon, el.classList.contains('inline') || el.classList.contains('qa-btn') ? 15 : 18);
  if (el.textContent.trim()) el.insertAdjacentHTML('afterbegin', svg);
  else el.innerHTML = svg;
});

/* Cronómetro "Hace hh:mm:ss" de las habitaciones ocupadas.
   Se recalcula cada segundo sobre los elementos visibles. */
function fmtElapsed(iso){
  if (!iso) return '--:--:--';
  const t = Math.floor(Math.max(0, Date.now() - new Date(iso).getTime()) / 1000);
  return `${String(Math.floor(t/3600)).padStart(2,'0')}:${String(Math.floor((t%3600)/60)).padStart(2,'0')}:${String(t%60).padStart(2,'0')}`;
}
/* Cuenta regresiva "hasta cuándo dura el bloqueo de 12 h" de una habitación. */
function fmtHasta(iso){
  if (!iso) return '--:--:--';
  const t = Math.ceil((new Date(iso).getTime() - Date.now()) / 1000);
  if (t <= 0) return '00:00:00';
  return `${String(Math.floor(t/3600)).padStart(2,'0')}:${String(Math.floor((t%3600)/60)).padStart(2,'0')}:${String(t%60).padStart(2,'0')}`;
}
function tickTimers(){
  $$('.room-card .timer[data-checkin]').forEach(el => { el.textContent = 'Hace ' + fmtElapsed(el.dataset.checkin); });
  $$('.room-card .timer[data-reserva-fin]').forEach(el => { el.textContent = 'Ocupada hasta ' + fmtHasta(el.dataset.reservaFin); });
}
setInterval(tickTimers, 1000);

let session = getUser();
let currentView = 'resumen';
let socket = null;

/* ============================================================
   LOGIN
   ============================================================ */
// Mostrar/ocultar contraseña y aviso de Bloq Mayús.
$('#pass-toggle').addEventListener('click', ()=>{
  const input = $('#login-pass');
  const visible = input.type === 'text';
  input.type = visible ? 'password' : 'text';
  $('#pass-toggle').innerHTML = icon(visible ? 'ojo' : 'ojoOff');
  $('#pass-toggle').setAttribute('aria-label', visible ? 'Mostrar contraseña' : 'Ocultar contraseña');
  input.focus();
});
['keydown','keyup'].forEach(evt => $('#login-pass').addEventListener(evt, e=>{
  if (e.getModifierState) $('#caps-hint').classList.toggle('show', e.getModifierState('CapsLock'));
}));

$('#login-form').addEventListener('submit', async e=>{
  e.preventDefault();
  const username = $('#login-user').value.trim().toLowerCase();
  const password = $('#login-pass').value;
  const errBox = $('#login-error');
  errBox.classList.remove('show');
  if(!username || !password){ errBox.textContent = 'Escribe tu usuario y contraseña.'; errBox.classList.add('show'); return; }
  $('#btn-login').disabled = true;
  $('#btn-login').textContent = 'Verificando…';
  try{
    // El rol (admin o recepción) lo decide la cuenta en el servidor.
    const data = await api('/auth/login', { method:'POST', body:{ username, password } });
    setSession(data.token, data.user);
    session = data.user;
    $('#login-pass').value = '';
    enterApp();
  }catch(err){
    void errBox.offsetWidth; // reinicia la animación de "sacudida"
    errBox.textContent = err.message;
    errBox.classList.add('show');
    $('#login-pass').select();
  }finally{
    $('#btn-login').disabled = false;
    $('#btn-login').textContent = 'Ingresar';
  }
});

$('#btn-logout').addEventListener('click', async ()=>{
  const ok = await confirmDialog({ title:'¿Cerrar sesión?', message:'Tendrás que volver a ingresar tu usuario y contraseña.', confirmText:'Cerrar sesión', danger:false, iconName:'salir' });
  if(!ok) return;
  clearSession();
  location.reload();
});

/* La foto se inserta como elemento DOM (no como HTML en texto): así un
   dato manipulado nunca puede convertirse en código ejecutable. */
function avatarInto(box, foto, nombre){
  box.innerHTML = '';
  if (foto && /^data:image\/(png|jpe?g|webp);base64,/.test(foto)){
    const img = document.createElement('img');
    img.src = foto; img.alt = 'Foto de perfil';
    box.appendChild(img);
  } else {
    const span = document.createElement('span');
    span.textContent = (nombre || '?').charAt(0).toUpperCase();
    box.appendChild(span);
  }
}
function renderUserAvatar(){ avatarInto($('#user-avatar'), session.foto, session.nombre); }

function renderAlertas(){
  const zone = $('#alert-zone');
  if (!session.passwordPorDefecto){ zone.innerHTML = ''; return; }
  zone.innerHTML = `<div class="alert-banner">${icon('escudo', 22)}
    <div><b>Protege tu cuenta.</b> Todavía usas la contraseña de fábrica; cualquiera que la conozca podría entrar al sistema.</div>
    <button class="btn btn-sm btn-gold" id="alert-go-cfg">Cambiar ahora</button></div>`;
  $('#alert-go-cfg').onclick = () => document.querySelector('.navlist button[data-view="configuracion"]').click();
}

function enterApp(){
  $('#login-screen').style.display='none';
  $('#app-screen').classList.add('active');
  $('#user-name').textContent = session.nombre;
  $('#user-role').textContent = session.role==='admin' ? 'Administrador' : 'Recepcionista';
  renderUserAvatar();
  renderAlertas();
  applyRoleRestrictions();
  startClock();
  connectRealtime();
  showSkeletons();
  renderAll();
}

function showSkeletons(){
  $('#kpi-grid').innerHTML = Array.from({length:5}, ()=>'<div class="skeleton sk-kpi"></div>').join('');
  $('#rooms-grid-mini').innerHTML = Array.from({length:8}, ()=>'<div class="skeleton sk-room"></div>').join('');
}

function applyRoleRestrictions(){
  const isAdmin = session.role==='admin';
  // Finanzas: recepción puede registrar GASTOS (egresos); los ingresos manuales son solo del admin.
  $('#fin-tipo').value = 'egreso';
  $('#fin-tipo').disabled = !isAdmin;
  $('#btn-cierre-general').style.display = isAdmin ? '' : 'none';
  $('#inv-form-block').classList.toggle('role-locked', !isAdmin);
  $$('#inv-form-block input, #btn-add-inv').forEach(el=> el.disabled = !isAdmin);
  $('#btn-add-room').style.display = isAdmin ? '' : 'none';
  $('#btn-backup').style.display = isAdmin ? '' : 'none';
  // Acciones rápidas: ingreso de productos solo admin; gastos y ventas, ambos.
  $('#btn-qa-ingreso').disabled = !isAdmin;
  const empForm = $('#emp-form-block');
  if(empForm){
    empForm.classList.toggle('role-locked', !isAdmin);
    $$('#emp-form-block input, #emp-form-block button').forEach(el=> el.disabled = !isAdmin);
  }
}


/* ============================================================
   DESCARGAS (Excel / respaldo) — piden el archivo con el token
   de sesión y lo entregan al navegador como si fuera un link normal.
   ============================================================ */
async function downloadFile(path, fallbackName){
  try{
    const token = getToken();
    const res = await fetch('/api'+path, { headers: token ? { Authorization: 'Bearer '+token } : {} });
    if(!res.ok){
      const data = await res.json().catch(()=>({}));
      throw new Error(data.error || 'No se pudo generar el archivo.');
    }
    const blob = await res.blob();
    const disposition = res.headers.get('Content-Disposition') || '';
    const match = disposition.match(/filename="?([^"]+)"?/);
    const filename = match ? match[1] : fallbackName;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  }catch(err){ showError(err); }
}

$('#btn-export-excel').addEventListener('click', async e=>{
  const btn = e.currentTarget;
  btn.classList.add('is-busy');
  toast('Generando reporte de Excel…');
  await downloadFile('/export/reporte', 'reporte-hostal-dorado.xlsx');
  btn.classList.remove('is-busy');
});
$('#btn-backup')?.addEventListener('click', async e=>{
  if(session.role!=='admin'){ toast('Solo el administrador puede descargar el respaldo', true); return; }
  const btn = e.currentTarget;
  btn.classList.add('is-busy');
  toast('Preparando respaldo de la base de datos…');
  await downloadFile('/export/backup', 'hostal-dorado-backup.db');
  btn.classList.remove('is-busy');
});

/* ============================================================
   NAVEGACIÓN
   ============================================================ */
const pageMeta = {
  resumen:{title:'Resumen', sub:'Cómo está el hostal ahora mismo'},
  habitaciones:{title:'Habitaciones', sub:'Toca una habitación libre para hacer check-in, o una ocupada para cobrar y dar salida'},
  huespedes:{title:'Huéspedes', sub:'Busca a un huésped por documento o nombre y mira sus estancias'},
  finanzas:{title:'Finanzas', sub:'Todo lo que entró y salió de dinero, y el balance acumulado'},
  reservas:{title:'Reservas', sub:'Solicitudes de la web por confirmar y ocupación de la semana'},
  inventario:{title:'Inventario', sub:'Productos, stock y ventas a huéspedes'},
  empleados:{title:'Personal', sub:'Jornadas de limpieza e incidencias por resolver'},
  caja:{title:'Caja y comprobantes', sub:'Cuánto hay en caja por forma de pago, cierres de turno y boletas'},
  configuracion:{title:'Configuración', sub:'Tu cuenta, datos del hostal, copias de seguridad y usuarios'},
};

$$('.navlist button').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    currentView = btn.dataset.view;
    $$('.navlist button').forEach(b=>{ b.classList.remove('active'); b.removeAttribute('aria-current'); });
    btn.classList.add('active');
    btn.setAttribute('aria-current', 'page');
    $$('.view').forEach(v=>v.classList.remove('active'));
    $('#view-'+currentView).classList.add('active');
    $('#page-title').textContent = pageMeta[currentView].title;
    $('#page-sub').textContent = pageMeta[currentView].sub;
    document.title = `${pageMeta[currentView].title} · Hostal Dorado`;
    $('#main').scrollTo({ top: 0 });
    if(window.innerWidth<=820){ $('#sidebar').classList.remove('open'); $('#sidebar-scrim').classList.remove('open'); }
    renderAll();
  });
});
$('#menu-toggle').addEventListener('click', ()=>{
  $('#sidebar').classList.toggle('open'); $('#sidebar-scrim').classList.toggle('open');
});
$('#sidebar-scrim').addEventListener('click', ()=>{
  $('#sidebar').classList.remove('open'); $('#sidebar-scrim').classList.remove('open');
});

/* ============================================================
   RELOJ
   ============================================================ */
function startClock(){
  const dias = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
  const meses = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  function tick(){
    const now = new Date();
    $('#clock-time').textContent = now.toLocaleTimeString('es-PE',{hour12:false});
    const dia = dias[now.getDay()];
    $('#clock-date').textContent = `${dia.charAt(0).toUpperCase() + dia.slice(1)}, ${now.getDate()} de ${meses[now.getMonth()]}`;
  }
  tick(); setInterval(tick, 1000);
}

/* ============================================================
   TIEMPO REAL (Socket.io)
   ---------------------------------------------------------------
   El servidor emite 'rooms:changed', 'finance:changed' e
   'inventory:changed' cada vez que ALGUIEN (en cualquier
   dispositivo) hace un cambio. Aquí solo escuchamos y volvemos a
   pedir los datos de la vista actual — así todos los equipos del
   hostal ven siempre la misma información, sin recargar la página.
   ============================================================ */
let refreshTimer = null;
/* Varios cambios seguidos (p. ej. una venta emite inventario + finanzas)
   se agrupan en UNA sola recarga de la vista. */
function scheduleRefresh(){
  clearTimeout(refreshTimer);
  const chip = $('#conn-chip');
  chip.classList.add('sync');
  refreshTimer = setTimeout(()=>{ renderAll(); chip.classList.remove('sync'); }, 250);
}

function connectRealtime(){
  // El servidor solo acepta la conexión en tiempo real con una sesión válida.
  socket = io({ auth: { token: getToken() } });
  const chip = $('#conn-chip');
  socket.on('connect', ()=>{
    chip.className = 'conn-chip online';
    chip.querySelector('span').textContent = 'En línea · tiempo real';
  });
  socket.on('disconnect', ()=>{
    chip.className = 'conn-chip offline';
    chip.querySelector('span').textContent = 'Sin conexión — reintentando…';
  });
  socket.on('connect_error', err=>{
    if (err && err.message === 'unauthorized'){ socket.close(); api('/auth/me').catch(()=>{}); }
    chip.className = 'conn-chip offline';
    chip.querySelector('span').textContent = 'Sin conexión — reintentando…';
  });
  ['rooms:changed','finance:changed','inventory:changed','reservations:changed','notas:changed','incidencias:changed','staff:changed','caja:changed'].forEach(evt=>{
    socket.on(evt, scheduleRefresh);
  });
}

/* ============================================================
   TOASTS — notificaciones apiladas con ícono y barra de tiempo
   ============================================================ */
function toast(msg, type=false){
  if(!msg) return;
  const kind = type === true || type === 'error' ? 'error' : (type === 'success' ? 'success' : 'info');
  const box = $('#toast');
  const el = document.createElement('div');
  const dur = kind === 'error' ? 5200 : 3400;
  el.className = `toast ${kind}`;
  el.style.setProperty('--t', dur + 'ms');
  el.innerHTML = `<span class="t-ic">${icon(kind==='error' ? 'incidencia' : kind==='success' ? 'check' : 'info', 13)}</span><span></span>`;
  el.lastChild.textContent = msg;
  box.appendChild(el);
  while (box.children.length > 4) box.firstChild.remove();
  const quitar = ()=>{ el.classList.add('out'); setTimeout(()=> el.remove(), 300); };
  const t = setTimeout(quitar, dur);
  el.addEventListener('click', ()=>{ clearTimeout(t); quitar(); });
}
function showError(err){ if(err && !err.silent) toast(err.message, 'error'); }

/* ============================================================
   MODAL — con botón de cierre, tecla Esc y foco automático
   ============================================================ */
let modalOnClose = null;
let modalGen = 0; // evita que el cierre animado borre un modal abierto justo después
let modalOrigen = null; // elemento que abrió el modal: recibe el foco al cerrar
function openModal(html, { wide=false } = {}){
  modalGen++;
  if (!$('#modal-backdrop').classList.contains('open')) modalOrigen = document.activeElement;
  const box = $('#modal-box');
  box.className = 'modal' + (wide ? ' modal-wide' : '');
  box.innerHTML = `<button class="modal-close" type="button" aria-label="Cerrar">${icon('cerrar', 18)}</button>` + html;
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-modal', 'true');
  const titulo = box.querySelector('h3');
  if (titulo){ titulo.id = 'modal-titulo'; box.setAttribute('aria-labelledby', 'modal-titulo'); }
  else box.removeAttribute('aria-labelledby');
  box.querySelector('.modal-close').onclick = closeModal;
  const bd = $('#modal-backdrop');
  bd.classList.remove('closing');
  bd.classList.add('open');
  const first = box.querySelector('input:not([disabled]):not([type=hidden]), select, textarea');
  setTimeout(()=> (first || box.querySelector('.btn-gold, .btn'))?.focus({ preventScroll:true }), 60);
}
function closeModal(){
  const bd = $('#modal-backdrop');
  if(!bd.classList.contains('open')) return;
  bd.classList.add('closing');
  const gen = modalGen;
  setTimeout(()=>{
    if(gen !== modalGen) return;
    bd.classList.remove('open','closing'); $('#modal-box').innerHTML='';
    if (modalOrigen && document.contains(modalOrigen)) modalOrigen.focus({ preventScroll:true });
    modalOrigen = null;
  }, 170);
  if (modalOnClose){ const fn = modalOnClose; modalOnClose = null; fn(); }
}
$('#modal-backdrop').addEventListener('click', e=>{ if(e.target.id==='modal-backdrop') closeModal(); });
document.addEventListener('keydown', e=>{
  if(!$('#modal-backdrop').classList.contains('open')) return;
  if(e.key==='Escape'){ closeModal(); return; }
  // Tab no sale del modal: del último elemento vuelve al primero y viceversa.
  if(e.key==='Tab'){
    const f = $$('#modal-box button:not([disabled]), #modal-box input:not([disabled]):not([type=hidden]), #modal-box select:not([disabled]), #modal-box textarea:not([disabled]), #modal-box a[href]')
      .filter(el => el.offsetParent !== null);
    if(!f.length) return;
    const first = f[0], last = f[f.length-1];
    if(e.shiftKey && document.activeElement === first){ e.preventDefault(); last.focus(); }
    else if(!e.shiftKey && document.activeElement === last){ e.preventDefault(); first.focus(); }
  }
});

/* Diálogo de confirmación para acciones que no se pueden deshacer. */
function confirmDialog({ title, message, confirmText='Confirmar', danger=true, iconName }){
  return new Promise(resolve=>{
    let decidido = false;
    const decidir = v => { if(decidido) return; decidido = true; resolve(v); };
    openModal(`
      <div class="confirm-box">
        <div class="confirm-ic${danger ? '' : ' neutral'}">${icon(iconName || (danger ? 'basura' : 'info'), 24)}</div>
        <h3>${escapeHTML(title)}</h3>
        <p>${escapeHTML(message)}</p>
        <div class="modal-actions">
          <button class="btn" id="cf-no">Cancelar</button>
          <button class="btn ${danger ? 'btn-danger-solid' : 'btn-gold'}" id="cf-si">${escapeHTML(confirmText)}</button>
        </div>
      </div>`);
    modalOnClose = () => decidir(false);
    $('#cf-no').onclick = () => closeModal();
    $('#cf-si').onclick = () => { modalOnClose = null; closeModal(); decidir(true); };
    setTimeout(()=> $('#cf-si')?.focus(), 70);
  });
}

/* KPI con animación de conteo: los números "suben" hasta su valor. */
const kpiPrevios = new Map();
function kpi(label, value, note, extraClass='', iconName='', meterPct=null){
  return `<div class="kpi ${extraClass}">
    <div class="kpi-head"><p class="kpi-label">${label}</p>${iconName? `<span class="kpi-ic">${icon(iconName)}</span>`:''}</div>
    <p class="kpi-value" data-kpi="${escapeHTML(label)}">${value}</p>
    ${meterPct!=null ? `<div class="kpi-meter"><i style="width:${Math.max(0,Math.min(100,meterPct))}%"></i></div>` : ''}
    <p class="kpi-note">${note}</p></div>`;
}
function animarKpis(scope){
  scope.querySelectorAll('.kpi-value[data-kpi]').forEach(el=>{
    const texto = el.textContent;
    const m = texto.match(/-?[\d.]+/);
    if(!m) return;
    const fin = parseFloat(m[0]);
    const dec = (m[0].split('.')[1] || '').length;
    const clave = el.dataset.kpi;
    const inicio = kpiPrevios.has(clave) ? kpiPrevios.get(clave) : 0;
    kpiPrevios.set(clave, fin);
    if(inicio === fin || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const t0 = performance.now(), dur = 900;
    const paso = now=>{
      const p = Math.min(1, (now - t0) / dur);
      const e = 1 - Math.pow(1 - p, 3);
      el.textContent = texto.replace(m[0], (inicio + (fin - inicio) * e).toFixed(dec));
      if(p < 1) requestAnimationFrame(paso);
    };
    requestAnimationFrame(paso);
  });
}
function emptyNote(msg){ return `<p class="empty-note">${msg}</p>`; }

function chart7days(last7, field){
  const days = [];
  for(let i=6;i>=0;i--){ const d = new Date(); d.setDate(d.getDate()-i); days.push(isoLocal(d)); }
  const byDay = {};
  (last7||[]).forEach(r=> byDay[r.fecha] = r);
  const totals = days.map(d => (byDay[d] ? Number(byDay[d][field]) : 0));
  const max = Math.max(...totals, 1);
  return days.map((day,i)=>{
    const h = Math.round((totals[i]/max)*100);
    const d = new Date(day+'T12:00:00');
    const label = d.toLocaleDateString('es-PE',{weekday:'short'}).replace('.','');
    return `<div class="bar-col">
      <div class="bar-value">${totals[i]>0? totals[i].toFixed(0) : ''}</div>
      <div class="bar-track"><div class="bar-fill" style="height:${h}%"></div></div>
      <div class="bar-label">${label}</div>
    </div>`;
  }).join('');
}

/* ------------------------------------------------------------
   GRÁFICA "REALISTA" — compara semanas o meses completos, no solo
   los últimos 7 días. Usa last8Weeks / last6Months que ya vienen
   agregados por SQL desde /finance/summary.
   ------------------------------------------------------------ */
function chartPeriodos(rows, field, kind){
  const items = rows || [];
  const totals = items.map(r => Number(r[field] || 0));
  const max = Math.max(...totals, 1);
  return items.map(r=>{
    const total = Number(r[field] || 0);
    const h = Math.round((total/max)*100);
    let label;
    if (kind === 'semana') {
      const d = new Date(r.semana + 'T12:00:00');
      label = d.toLocaleDateString('es-PE',{day:'2-digit',month:'short'}).replace('.','');
    } else {
      const [y,m] = r.mes.split('-');
      label = new Date(Number(y), Number(m)-1, 1).toLocaleDateString('es-PE',{month:'short'}).replace('.','');
    }
    return `<div class="bar-col">
      <div class="bar-value">${total>0? total.toFixed(0) : ''}</div>
      <div class="bar-track"><div class="bar-fill" style="height:${h}%"></div></div>
      <div class="bar-label">${label}</div>
    </div>`;
  }).join('') || `<p class="empty-note" style="padding:0;">Aún no hay suficiente historial para comparar.</p>`;
}

/* Fabrica un selector Semana/Mes/Días y devuelve {wrap, render(summary)}
   para reutilizar la misma UI en Resumen y en Finanzas. */
function crearChartSwitcher(containerId, field){
  let modo = 'semana'; // 'dia' | 'semana' | 'mes'
  const container = document.getElementById(containerId);
  function pintar(summary){
    if(!container) return;
    const bars = modo==='dia' ? chart7days(summary.last7, field)
      : modo==='semana' ? chartPeriodos(summary.last8Weeks, field, 'semana')
      : chartPeriodos(summary.last6Months, field, 'mes');
    container.innerHTML = bars;
  }
  return { pintar, get modo(){ return modo; }, set modo(v){ modo = v; } };
}
const chartSwitchers = {};
function bindChartTabs(scopeSelector, key){
  $$(`${scopeSelector} .chart-tab`).forEach(btn=>{
    btn.addEventListener('click', ()=>{
      $$(`${scopeSelector} .chart-tab`).forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      chartSwitchers[key].modo = btn.dataset.periodo;
      renderAll();
    });
  });
}
chartSwitchers.resumen = crearChartSwitcher('chart-resumen', 'ingresos');
bindChartTabs('#chart-resumen-wrap', 'resumen');

/* ============================================================
   RENDER MASTER — decide qué pedir según la vista activa
   ============================================================ */
function renderAll(){
  if(currentView==='resumen') renderResumen();
  if(currentView==='habitaciones') renderHabitaciones();
  if(currentView==='huespedes') { /* se refresca solo al buscar */ }
  if(currentView==='finanzas') renderFinanzas();
  if(currentView==='reservas') renderReservas();
  if(currentView==='inventario') renderInventario();
  if(currentView==='empleados') renderEmpleados();
  if(currentView==='configuracion') { renderConfiguracion(); renderAdminConfig(); }
  if(currentView==='caja') renderCaja();
  updateBadges();
}

/* Insignias del menú lateral: pre-reservas por confirmar e incidencias abiertas. */
async function updateBadges(){
  try{
    const [{ reservations }, { incidencias }] = await Promise.all([ api('/reservations?estado=pendiente'), api('/incidencias') ]);
    const set = (id, n)=>{ const b = $(id); b.textContent = n > 9 ? '9+' : n; b.classList.toggle('show', n > 0); };
    set('#badge-reservas', reservations.length);
    set('#badge-incidencias', incidencias.filter(i=>i.estado!=='resuelta').length);
  }catch(_){ /* las insignias son informativas */ }
}

/* ------------------------------------------------------------
   RESUMEN
   ------------------------------------------------------------ */
async function renderResumen(){
  try{
    const [{rooms}, summary, {finance}, {inventory}, {reservations}, {incidencias}] = await Promise.all([
      api('/rooms'), api('/finance/summary'), api('/finance'), api('/inventory'), api('/reservations?estado=pendiente'), api('/incidencias'),
    ]);

    const total = rooms.length;
    const ocupadas = rooms.filter(r=>r.estado==='ocupado').length;
    const libres = rooms.filter(r=>r.estado==='libre').length;
    const ocupacion = total? Math.round(ocupadas/total*100) : 0;
    const stockBajo = inventory.filter(p=>Number(p.stock)<=Number(p.stock_minimo)).length;
    const incAbiertas = incidencias.filter(i=>i.estado!=='resuelta').length;

    $('#kpi-grid').innerHTML = `
      ${kpi('Ocupación actual', ocupacion+'%', `${ocupadas} de ${total} habitaciones`, '', 'resumen', ocupacion)}
      ${kpi('Habitaciones libres', libres, 'Disponibles ahora', '', 'habitaciones', total ? libres/total*100 : 0)}
      ${kpi('Ingresos de hoy', money(summary.hoy.ingresos), `Egresos: ${money(summary.hoy.egresos)}`, '', 'finanzas')}
      ${kpi('Stock bajo', stockBajo, stockBajo ? 'Productos por reponer' : 'Inventario en orden', stockBajo>0?'danger-border':'', 'inventario')}
      ${kpi('Incidencias abiertas', incAbiertas, incAbiertas? 'Por atender':'Todo al día', incAbiertas>0?'danger-border':'', 'incidencia')}
    `;
    animarKpis($('#kpi-grid'));

    $('#rooms-grid-mini').innerHTML = rooms.slice(0,8).map(roomCardHTML).join('') || emptyNote('Sin habitaciones registradas.');
    tickTimers();
    chartSwitchers.resumen.pintar(summary);

    // Punto de notificación de la pestaña "Notas": se enciende con datos reales.
    $('#notif-dot-notas').style.display = (reservations.length > 0 || stockBajo > 0 || incAbiertas > 0) ? 'block' : 'none';

    const recientes = [...finance].slice(0,6);
    $('#tbl-movimientos-recientes').innerHTML = recientes.map(f=>`
      <tr>
        <td>${fmtDate(f.fecha)}</td>
        <td>${escapeHTML(f.concepto)}</td>
        <td>${f.tipo==='ingreso'?'<span class="pill pill-ok">Ingreso</span>':'<span class="pill pill-danger">Egreso</span>'}</td>
        <td class="${f.tipo==='ingreso'?'amount-in':'amount-out'}">${f.tipo==='ingreso'?'+':'-'}${money(f.monto)}</td>
      </tr>
    `).join('') || `<tr><td colspan="4" class="empty-note">Aún no hay movimientos.</td></tr>`;

    bindRoomCardClicks();
    renderSidePanel();
  }catch(err){ showError(err); }
}

/* ------------------------------------------------------------
   HABITACIONES
   ------------------------------------------------------------ */
/* Etiqueta de precio: por horas ("S/30 x 3h") o por noche ("S/60 / noche"). */
function precioLabel(r){
  if (r.unidad === 'hora') return `${money(r.precio)} x ${r.bloque_horas || 3}h`;
  return `${money(r.precio)} / noche`;
}

function roomCardHTML(r){
  const estadoLabel = {libre:'Libre', ocupado:'Ocupada', limpieza:'Limpieza', mantenimiento:'Mantenimiento'}[r.estado];
  const nowI = new Date().toISOString();
  const reservaActiva = r.estado === 'libre' && r.reserva_inicio && r.reserva_inicio <= nowI && r.reserva_fin > nowI;
  const reservaFutura = !reservaActiva && r.estado === 'libre' && r.reserva_fin && r.reserva_fin > nowI;
  const top = `
    <div class="room-card room-${r.estado}${reservaActiva ? ' room-reserva' : ''}" data-id="${r.id}" role="button" tabindex="0">
      <div class="rc-top">
        <div>
          <div class="rn">${escapeHTML(r.numero)}</div>
          <div class="rt">${escapeHTML(r.categoria || r.tipo)} · ${precioLabel(r)}</div>
        </div>`;
  if (r.estado === 'ocupado') {
    const guestName = r.guest_nombres ? `${r.guest_nombres} ${r.guest_apellidos}` : '';
    return top + `<button class="btn-exit" data-exit="${r.id}" title="Registrar salida / check-out">${icon('salir', 13)} Salir</button>
      </div>
      <div class="rc-bottom">
        <div class="rs">Ocupada</div>
        <div class="rg guest">${escapeHTML(guestName)}</div>
        <div class="rg timer" data-checkin="${r.stay_created_at || ''}">Hace --:--:--</div>
      </div>
    </div>`;
  }
  if (reservaActiva) {
    return top + `</div>
      <div class="rc-bottom">
        <div class="rs rs-reserva">Ocupada (reserva 12 h)</div>
        <div class="rg guest">${escapeHTML(r.reserva_nombre || '')}</div>
        <div class="rg timer" data-reserva-fin="${r.reserva_fin}">Ocupada hasta --:--:--</div>
      </div>
    </div>`;
  }
  if (reservaFutura) {
    return top + `</div>
      <div class="rc-bottom">
        <div class="rs">${estadoLabel}</div>
        <div class="rg guest">Reservada ${fmtDT(r.reserva_inicio)} → ${fmtDT(r.reserva_fin)}</div>
      </div>
    </div>`;
  }
  return top + `</div>
      <div class="rc-bottom">
        <div class="rs">${estadoLabel}</div>
      </div>
    </div>`;
}

let roomsCache = [];
let roomCategoriaFiltro = '';
let roomEstadoFiltro = '';
// Orden en el que se muestran las categorías (de la más económica a la más grande).
const ORDEN_CATEGORIAS = ['Estándar (por horas)','Estándar','Estándar Plus','Ducha eléctrica','Suite','Familiar','Departamento'];

async function renderHabitaciones(){
  try{
    const { rooms } = await api('/rooms');
    roomsCache = rooms;
    renderCategoriaPills();
    applyRoomFilter();
  }catch(err){ showError(err); }
}

/* Las pills de "tipo" ahora se generan solas a partir de las categorías
   que realmente existen en las habitaciones (no una lista fija en el
   HTML), así admite cualquier categoría que el admin cree después. */
function renderCategoriaPills(){
  const cats = Array.from(new Set(roomsCache.map(r=>r.categoria || r.tipo)))
    .sort((a,b)=> (ORDEN_CATEGORIAS.indexOf(a)+1 || 99) - (ORDEN_CATEGORIAS.indexOf(b)+1 || 99));
  const box = $('#filter-tipo');
  box.innerHTML = `<button class="pill-btn${roomCategoriaFiltro? '':' active'}" data-tipo="">Todas</button>`
    + cats.map(c=>`<button class="pill-btn${roomCategoriaFiltro===c?' active':''}" data-tipo="${escapeHTML(c)}">${escapeHTML(c)}</button>`).join('');
  $$('#filter-tipo .pill-btn').forEach(btn=> btn.addEventListener('click', ()=>{
    $$('#filter-tipo .pill-btn').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    roomCategoriaFiltro = btn.dataset.tipo || '';
    applyRoomFilter();
  }));
}

function applyRoomFilter(){
  const texto = ($('#room-filter').value || '').trim().toLowerCase();
  const filtradas = roomsCache.filter(r=>{
    const okTexto = !texto || String(r.numero).toLowerCase().includes(texto);
    const okTipo = !roomCategoriaFiltro || (r.categoria || r.tipo) === roomCategoriaFiltro;
    const okEstado = !roomEstadoFiltro || r.estado === roomEstadoFiltro;
    return okTexto && okTipo && okEstado;
  });

  // Agrupa por categoría (Estándar, Ducha eléctrica, Suite, Familiar,
  // Departamento…) en vez de por piso, tal como pidió el hostal.
  const porCategoria = {};
  filtradas.forEach(r=>{ const c = r.categoria || r.tipo; (porCategoria[c] || (porCategoria[c] = [])).push(r); });
  const categoriasOrdenadas = Object.keys(porCategoria).sort((a,b)=>{
    const ia = ORDEN_CATEGORIAS.indexOf(a), ib = ORDEN_CATEGORIAS.indexOf(b);
    return (ia===-1?99:ia) - (ib===-1?99:ib);
  });
  categoriasOrdenadas.forEach(c=> porCategoria[c].sort((a,b)=> Number(a.numero)-Number(b.numero)));

  $('#rooms-grid-full').innerHTML = categoriasOrdenadas
    .map(c=> `<div class="piso-label">${escapeHTML(c.toUpperCase())}</div><div class="rooms-grid">${porCategoria[c].map(roomCardHTML).join('')}</div>`)
    .join('') || emptyNote('Ninguna habitación coincide con el filtro.');

  tickTimers();
  bindRoomCardClicks();
}
$('#room-filter').addEventListener('input', applyRoomFilter);

$$('#filter-estado .pill-btn').forEach(btn=> btn.addEventListener('click', ()=>{
  $$('#filter-estado .pill-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  roomEstadoFiltro = btn.dataset.estado || '';
  applyRoomFilter();
}));

function bindRoomCardClicks(){
  $$('.room-card').forEach(card=>{
    card.addEventListener('click', ()=> openRoomModal(card.dataset.id));
    card.addEventListener('keydown', e=>{ if(e.key==='Enter' || e.key===' '){ e.preventDefault(); openRoomModal(card.dataset.id); } });
  });
  // Botón "Salir" dentro de la tarjeta ocupada: abre el check-out directo.
  $$('.btn-exit').forEach(btn=>{
    btn.addEventListener('click', (e)=>{
      e.stopPropagation();
      openRoomModal(btn.dataset.exit);
    });
  });
}

async function openRoomModal(id){
  let room;
  try{
    const { rooms } = await api('/rooms');
    roomsCache = rooms;
    room = rooms.find(r=>r.id===id);
  }catch(err){ showError(err); return; }
  if(!room) return;

  if(room.estado==='libre'){
    const esHora = room.unidad === 'hora';
    openModal(`
      <h3>Check-in — Habitación ${escapeHTML(room.numero)}</h3>
      <p class="modal-sub">${escapeHTML(room.categoria || room.tipo)} · ${precioLabel(room)}</p>
      <p class="modal-note">Según la normativa peruana de hospedaje, todo huésped debe registrarse con su documento de identidad.</p>
      <div class="modal-grid">
        <div class="field"><label>Tipo de documento</label>
          <select id="ci-tipo-doc">
            <option value="DNI">DNI</option>
            <option value="Pasaporte">Pasaporte</option>
            <option value="Carné de Extranjería">Carné de Extranjería</option>
          </select>
        </div>
        <div class="field">
          <label>N.º de documento</label>
          <div style="display:flex;gap:6px;">
            <input id="ci-num-doc" type="text" placeholder="Ej. 45678912" maxlength="15" style="flex:1;">
            <button type="button" class="btn btn-sm" id="ci-buscar-doc" title="Buscar si ya es huésped">Buscar</button>
          </div>
        </div>
      </div>
      <p class="field-error" id="ci-doc-error"></p>
      <p class="modal-note hidden" id="ci-doc-found">Huésped encontrado — datos autocompletados.</p>
      <div class="modal-grid">
        <div class="field"><label>Nombres</label><input id="ci-nombres" type="text" placeholder="Nombres"></div>
        <div class="field"><label>Apellidos</label><input id="ci-apellidos" type="text" placeholder="Apellidos"></div>
      </div>
      <div class="modal-grid">
        <div class="field"><label>Nacionalidad</label><input id="ci-nacionalidad" type="text" value="Peruana"></div>
        <div class="field"><label>Teléfono</label><input id="ci-telefono" type="text" placeholder="Opcional"></div>
      </div>
      <div class="modal-grid">
        <div class="field"><label>Procedencia</label><input id="ci-procedencia" type="text" placeholder="Ciudad de origen"></div>
        <div class="field"><label>Destino</label><input id="ci-destino" type="text" placeholder="Próximo destino"></div>
      </div>
      <div class="modal-grid">
        <div class="field"><label>Motivo de viaje</label><input id="ci-motivo" type="text" placeholder="Turismo, negocios…"></div>
        <div class="field"><label>${esHora ? `Bloques de ${room.bloque_horas || 3} h` : 'Noches'}</label><input id="ci-noches" type="number" min="1" step="1" value="1"></div>
      </div>
      <p class="modal-note" id="ci-total-note">Total estimado: <b>${money(room.precio)}</b></p>
      <div class="modal-actions">
        <button class="btn" id="modal-cancel">Cancelar</button>
        <button class="btn btn-gold" id="modal-checkin">Confirmar check-in</button>
      </div>
    `);
    $('#ci-noches').addEventListener('input', ()=>{
      const n = Math.max(1, parseInt($('#ci-noches').value||'1',10));
      $('#ci-total-note').innerHTML = `Total estimado: <b>${money(room.precio*n)}</b>`;
    });
    $('#modal-cancel').onclick = closeModal;
    $('#ci-buscar-doc').onclick = async ()=>{
      const numero = $('#ci-num-doc').value.trim();
      if(!numero){ toast('Escribe primero el número de documento', true); return; }
      try{
        const { guests } = await api(`/guests?buscar=${encodeURIComponent(numero)}`);
        const match = guests.find(g=> g.numero_documento === numero);
        if(match){
          $('#ci-tipo-doc').value = match.tipo_documento;
          $('#ci-nombres').value = match.nombres;
          $('#ci-apellidos').value = match.apellidos;
          $('#ci-nacionalidad').value = match.nacionalidad;
          $('#ci-telefono').value = match.telefono || '';
          $('#ci-procedencia').value = match.procedencia || '';
          $('#ci-destino').value = match.destino || '';
          $('#ci-doc-found').classList.remove('hidden');
          toast('Huésped encontrado — datos autocompletados', 'success');
        } else {
          $('#ci-doc-found').classList.add('hidden');
          toast('No hay huéspedes anteriores con ese documento, completa sus datos');
        }
      }catch(err){ showError(err); }
    };
    $('#modal-checkin').onclick = async ()=>{
      const payload = {
        tipo_documento: $('#ci-tipo-doc').value,
        numero_documento: $('#ci-num-doc').value.trim(),
        nombres: $('#ci-nombres').value.trim(),
        apellidos: $('#ci-apellidos').value.trim(),
        nacionalidad: $('#ci-nacionalidad').value.trim() || 'Peruana',
        telefono: $('#ci-telefono').value.trim(),
        procedencia: $('#ci-procedencia').value.trim(),
        destino: $('#ci-destino').value.trim(),
        noches: Math.max(1, parseInt($('#ci-noches').value||'1', 10)),
        motivo_viaje: $('#ci-motivo').value.trim(),
      };
      $('#ci-doc-error').classList.remove('show');
      try{
        await api(`/rooms/${room.id}/checkin`, { method:'POST', body: payload });
        closeModal(); renderAll();
        toast(`Check-in registrado — Hab. ${room.numero}`, 'success');
      }catch(err){
        const msgDoc = err.detalles?.find(d=>d.campo==='numero_documento')?.mensaje;
        if(msgDoc){ $('#ci-doc-error').textContent = msgDoc; $('#ci-doc-error').classList.add('show'); }
        else showError(err);
      }
    };
  } else if(room.estado==='ocupado'){
    const nights = room.stay_nights || 1;
    const total = room.precio * nights;
    const esHora = room.unidad === 'hora';
    openModal(`
      <h3>Check-out — Habitación ${escapeHTML(room.numero)}</h3>
      <p class="modal-sub">${escapeHTML(room.guest_nombres||'')} ${escapeHTML(room.guest_apellidos||'')} · ${escapeHTML(room.guest_tipo_documento||'')} ${escapeHTML(room.guest_numero_documento||'')}</p>
      <div class="field"><label>${esHora ? `Bloques de ${room.bloque_horas||3} h a cobrar` : 'Noches a cobrar'} <small class="td-sub" style="display:inline">(${money(room.precio)} c/u)</small></label><input id="co-noches" type="number" min="1" value="${nights}"></div>
      <div id="co-cobro"></div>
      <div class="modal-actions">
        <button class="btn" id="modal-cancel">Cancelar</button>
        <button class="btn btn-gold" id="modal-checkout">${icon('check', 15)} Confirmar check-out y cobrar</button>
      </div>
    `, { wide: true });
    const cobro = crearCobro($('#co-cobro'), {
      total, comprobante: 'boleta',
      cliente: { doc_tipo: room.guest_tipo_documento, doc: room.guest_numero_documento, nombre: `${room.guest_nombres||''} ${room.guest_apellidos||''}`.trim() },
    });
    $('#modal-cancel').onclick = closeModal;
    $('#co-noches').addEventListener('input', ()=>{
      const n = Math.max(1, parseInt($('#co-noches').value||'1',10));
      cobro.setTotal(room.precio*n);
    });
    $('#modal-checkout').onclick = async ()=>{
      let datos;
      try { datos = cobro.leer(); } catch (e) { toast(e.message, true); return; }
      try{
        const res = await api(`/rooms/${room.id}/checkout`, {
          method:'POST',
          body:{ noches_finales: parseInt($('#co-noches').value||String(nights),10), ...datos },
        });
        renderAll();
        mostrarCobroExitoso({ titulo: `Check-out Hab. ${room.numero}`, total: res.total, pagos: res.pagos, comprobante: res.comprobante, vuelto: res.comprobante ? res.comprobante.vuelto : (datos.recibido != null ? datos.recibido - (res.pagos.find(p=>p.metodo==='Efectivo')?.monto||0) : null) });
      }catch(err){ showError(err); }
    };
  } else {
    openModal(`
      <h3>Habitación ${escapeHTML(room.numero)}</h3>
      <p class="modal-sub">Estado actual: ${room.estado==='limpieza'?'En limpieza':'En mantenimiento'}</p>
      <div class="field"><label>Cambiar estado</label>
        <select id="mo-estado">
          <option value="libre">Marcar como libre</option>
          <option value="limpieza">En limpieza</option>
          <option value="mantenimiento">En mantenimiento</option>
        </select>
      </div>
      <div class="modal-actions">
        <button class="btn" id="modal-cancel">Cancelar</button>
        ${session.role==='admin' ? '<button class="btn btn-danger" id="modal-delete">Eliminar habitación</button>' : ''}
        <button class="btn btn-gold" id="modal-save">Guardar</button>
      </div>
    `);
    $('#mo-estado').value = room.estado;
    $('#modal-cancel').onclick = closeModal;
    if($('#modal-delete')) $('#modal-delete').onclick = async ()=>{
      const ok = await confirmDialog({ title:`¿Eliminar la habitación ${room.numero}?`, message:'Se quitará del mapa de habitaciones. Esta acción no se puede deshacer.', confirmText:'Sí, eliminar' });
      if(!ok) return;
      try{ await api(`/rooms/${room.id}`, { method:'DELETE' }); renderAll(); toast(`Habitación ${room.numero} eliminada`, 'success'); }
      catch(err){ showError(err); }
    };
    $('#modal-save').onclick = async ()=>{
      try{ await api(`/rooms/${room.id}`, { method:'PATCH', body:{ estado: $('#mo-estado').value } }); closeModal(); renderAll(); toast(`Habitación ${room.numero} actualizada`, 'success'); }
      catch(err){ showError(err); }
    };
  }
}

$('#btn-add-room').addEventListener('click', ()=>{
  openModal(`
    <h3>Agregar habitación</h3>
    <div class="field"><label>Número</label><input id="na-num" type="text" placeholder="ej. 221"></div>
    <div class="field"><label>Categoría</label>
      <select id="na-tipo">${ORDEN_CATEGORIAS.map(c=>`<option>${escapeHTML(c)}</option>`).join('')}</select>
    </div>
    <div class="modal-grid">
      <div class="field"><label>Cobro por</label>
        <select id="na-unidad"><option value="noche">Noche</option><option value="hora">Bloque de horas</option></select>
      </div>
      <div class="field" id="na-bloque-wrap" style="display:none;"><label>Horas por bloque</label><input id="na-bloque" type="number" min="1" step="1" value="3"></div>
    </div>
    <div class="field"><label>Precio (S/)</label><input id="na-precio" type="number" min="0" step="1" placeholder="60"></div>
    <div class="modal-actions">
      <button class="btn" id="modal-cancel">Cancelar</button>
      <button class="btn btn-gold" id="modal-create">Crear</button>
    </div>
  `);
  $('#na-unidad').addEventListener('change', ()=>{
    $('#na-bloque-wrap').style.display = $('#na-unidad').value==='hora' ? '' : 'none';
  });
  $('#modal-cancel').onclick = closeModal;
  $('#modal-create').onclick = async ()=>{
    try{
      const numero = $('#na-num').value.trim();
      const categoria = $('#na-tipo').value;
      const unidad = $('#na-unidad').value;
      await api('/rooms', { method:'POST', body:{
        numero, tipo: categoria, categoria, unidad,
        bloque_horas: unidad==='hora' ? Number($('#na-bloque').value||3) : null,
        precio: Number($('#na-precio').value||0),
      }});
      closeModal(); renderAll();
      toast(`Habitación ${numero} creada`, 'success');
    }catch(err){ showError(err); }
  };
});

/* ------------------------------------------------------------
   HUÉSPEDES
   ------------------------------------------------------------ */
async function searchGuests(){
  const q = $('#guest-search').value.trim();
  try{
    const { guests } = await api('/guests' + (q ? `?buscar=${encodeURIComponent(q)}` : ''));
    $('#guest-hint').style.display = guests.length ? 'none' : 'block';
    $('#tbl-guests').innerHTML = guests.map(g=>`
      <tr>
        <td class="guest-doc">${escapeHTML(g.numero_documento)}<small>${escapeHTML(g.tipo_documento)}</small></td>
        <td>${escapeHTML(g.nombres)} ${escapeHTML(g.apellidos)}</td>
        <td>${escapeHTML(g.nacionalidad)}</td>
        <td>${escapeHTML(g.telefono||'—')}</td>
        <td><button class="btn btn-sm" data-hist="${g.id}">Ver historial</button></td>
      </tr>
    `).join('') || `<tr><td colspan="5" class="empty-note">Sin resultados.</td></tr>`;

    $$('button[data-hist]').forEach(btn=> btn.addEventListener('click', ()=> openGuestHistory(btn.dataset.hist)));
  }catch(err){ showError(err); }
}
$('#btn-guest-search').addEventListener('click', searchGuests);
$('#guest-search').addEventListener('keydown', e=>{ if(e.key==='Enter') searchGuests(); });

async function openGuestHistory(id){
  try{
    const { guest, stays } = await api(`/guests/${id}/history`);
    const rows = stays.map(s=>`
      <tr>
        <td>Hab. ${escapeHTML(s.room_numero)}</td>
        <td>${fmtDate(s.checkin_date)}${s.checkout_date? ' → '+fmtDate(s.checkout_date) : ' (activa)'}</td>
        <td>${s.nights}</td>
        <td>${s.total!=null ? money(s.total) : '—'}</td>
      </tr>
    `).join('') || `<tr><td colspan="4" class="empty-note">Sin estancias registradas.</td></tr>`;

    openModal(`
      <h3>${escapeHTML(guest.nombres)} ${escapeHTML(guest.apellidos)}</h3>
      <p class="modal-sub">${escapeHTML(guest.tipo_documento)} ${escapeHTML(guest.numero_documento)} · ${escapeHTML(guest.nacionalidad)}</p>
      <div class="table-wrap">
        <table><thead><tr><th>Habitación</th><th>Fechas</th><th>Noches</th><th>Total</th></tr></thead>
        <tbody>${rows}</tbody></table>
      </div>
      <div class="modal-actions"><button class="btn btn-gold" id="modal-cancel">Cerrar</button></div>
    `);
    $('#modal-cancel').onclick = closeModal;
  }catch(err){ showError(err); }
}

/* ------------------------------------------------------------
   FINANZAS
   ------------------------------------------------------------ */
async function renderFinanzas(){
  try{
    const [summary, { finance }] = await Promise.all([ api('/finance/summary'), api('/finance') ]);

    const desdeGen = summary.desdeCierreGeneral
      ? `Desde el cierre general del ${fmtDate(isoLocal(new Date(summary.desdeCierreGeneral.hasta)))}`
      : 'Desde el inicio del sistema';
    $('#kpi-finanzas').innerHTML = `
      ${kpi('Ingresos acumulados', money(summary.ingresosTotales), desdeGen, '', 'finanzas')}
      ${kpi('Egresos acumulados', money(summary.egresosTotales), desdeGen, '', 'gasto')}
      ${kpi('Balance actual', money(summary.balance), summary.balance>=0?'Saldo positivo':'Saldo negativo', summary.balance<0?'danger-border':'', 'wallet')}
      ${kpi('Ingresos de hoy', money(summary.hoy.ingresos), fmtDate(todayISO()), '', 'resumen')}
    `;
    animarKpis($('#kpi-finanzas'));
    $('#fin-metodos').innerHTML = metodosCardsHTML(summary.hoyPorMetodo || {});

    $('#tbl-finanzas').innerHTML = finance.map(f=>`
      <tr>
        <td>${fmtDate(f.fecha)}<small class="td-sub">${fmtDateTime(f.created_at).split(' · ')[1]}</small></td>
        <td>${escapeHTML(f.concepto)}<small class="td-sub">${escapeHTML(f.registrado_por||'')}</small></td>
        <td>${pagosHTML(f.pagos)}</td>
        <td class="${f.tipo==='ingreso'?'amount-in':'amount-out'}">${f.tipo==='ingreso'?'+':'−'}${money(f.monto)}</td>
        <td>${f.comprobante
          ? `<button class="comp-link" data-comp-print="${f.comprobante.id}" title="Imprimir">${icon('recibo', 13)} ${escapeHTML(f.comprobante.codigo)}</button>`
          : f.tipo==='ingreso' ? `<button class="btn btn-sm" data-emitir="${f.id}">Emitir</button>` : '<span class="td-sub">—</span>'}</td>
      </tr>
    `).join('') || `<tr><td colspan="5" class="empty-note">Aún no hay movimientos.</td></tr>`;
    const porId = Object.fromEntries(finance.map(f=>[f.id, f]));
    $$('#tbl-finanzas [data-comp-print]').forEach(b => b.onclick = () => imprimirComprobante(b.dataset.compPrint));
    $$('#tbl-finanzas [data-emitir]').forEach(b => b.onclick = () => abrirEmitirComprobante(porId[b.dataset.emitir]));
  }catch(err){ showError(err); }
}

$('#btn-add-fin').addEventListener('click', async ()=>{
  if(session.role!=='admin' && $('#fin-tipo').value!=='egreso'){ toast('Solo el administrador registra ingresos manuales', true); return; }
  const concepto = $('#fin-concepto').value.trim();
  const monto = Number($('#fin-monto').value);
  if(!concepto || !monto || monto<=0){ toast('Completa concepto y monto válido', true); return; }
  try{
    await api('/finance', { method:'POST', body:{ tipo: $('#fin-tipo').value, concepto, monto, metodo: $('#fin-metodo').value } });
    $('#fin-concepto').value=''; $('#fin-monto').value='';
    renderAll();
    toast('Movimiento registrado', 'success');
  }catch(err){ showError(err); }
});

/* ------------------------------------------------------------
   RESERVAS (pre-reservas del sitio público)
   ------------------------------------------------------------ */
const pillEstado = { pendiente: '<span class="pill pill-warn">Pendiente</span>', confirmada: '<span class="pill pill-ok">Confirmada</span>', cancelada: '<span class="pill pill-danger">Cancelada</span>' };

async function renderReservas(){
  const filtro = $('#res-filter-estado').value;
  renderCronograma();
  try{
    const { reservations } = await api('/reservations' + (filtro ? `?estado=${encodeURIComponent(filtro)}` : ''));
    $('#tbl-reservas').innerHTML = reservations.map(r=>{
      const acciones = `${contactoReserva(r)}` + (r.estado==='pendiente' ? `
        <button class="btn btn-sm btn-gold" data-res-confirm="${r.id}" data-res-tipo="${escapeHTML(r.tipo_habitacion)}">Confirmar</button>
        <button class="btn btn-sm btn-danger" data-res-cancel="${r.id}">Cancelar</button>` :
        r.estado==='confirmada' ? `<button class="btn btn-sm btn-danger" data-res-cancel="${r.id}">Cancelar</button>` : '<span class="empty-note" style="padding:0;">Sin acciones</span>');
      return `
      <tr>
        <td>${fmtDT(r.inicio)}</td>
        <td>${fmtDT(r.fin)}</td>
        <td>${escapeHTML(r.nombre)}</td>
        <td>${escapeHTML(r.tipo_habitacion)}${r.room_numero ? `<br><small>Hab. ${escapeHTML(r.room_numero)}</small>` : ''}</td>
        <td>${r.telefono? escapeHTML(r.telefono)+'<br>':''}${r.email? escapeHTML(r.email):''}</td>
        <td>${pillEstado[r.estado]}</td>
        <td style="white-space:nowrap;">${acciones}</td>
      </tr>`;
    }).join('') || `<tr><td colspan="7" class="empty-note">No hay pre-reservas${filtro? ' con ese estado':''}.</td></tr>`;

    $$('button[data-res-confirm]').forEach(btn=> btn.addEventListener('click', ()=> setReservaEstado(btn.dataset.resConfirm, 'confirmada', btn.dataset.resTipo)));
    $$('button[data-res-cancel]').forEach(btn=> btn.addEventListener('click', ()=> setReservaEstado(btn.dataset.resCancel, 'cancelada')));
  }catch(err){ showError(err); }
}
$('#res-filter-estado').addEventListener('change', renderReservas);

/* Enlace "Contactar" de cada pre-reserva: WhatsApp si el número parece
   móvil peruano (9xx xxx xxx), si no una llamada tel:. */
function contactoReserva(r){
  if(!r.telefono) return '';
  const t = String(r.telefono).replace(/\D/g, '');
  const msg = `Hola ${r.nombre}, sobre tu pre-reserva en Hostal Dorado (${r.tipo_habitacion}, ingreso ${r.inicio ? fmtDT(r.inicio).replace(' · ', ' a las ') : r.checkin} por 12 h).`;
  if (t.startsWith('9') && t.length === 9){
    return `<a class="btn btn-sm" href="https://wa.me/51${t}?text=${encodeURIComponent(msg)}" target="_blank" rel="noopener">Contactar</a> `;
  }
  return `<a class="btn btn-sm" href="tel:${r.telefono.replace(/[^\d+]/g, '')}">Contactar</a> `;
}

async function setReservaEstado(id, estado, tipo){
  if (estado === 'cancelada'){
    const ok = await confirmDialog({ title:'¿Cancelar esta pre-reserva?', message:'La habitación quedará libre para otros clientes. Avísale al huésped si ya lo contactaste.', confirmText:'Sí, cancelar' });
    if(!ok) return;
  }
  try{
    const res = await api(`/reservations/${id}`, { method:'PATCH', body:{ estado } });
    renderReservas();
    if (estado === 'confirmada'){
      const room = res.room || null;
      if (room){
        gotoHabitaciones();
        setTimeout(()=> resaltarHabitacion(room), 260);
        toast(`Pre-reserva confirmada · Hab. ${room.numero} (${tipo}) libre — haz check-in`, 'success');
      }else{
        toast('Pre-reserva confirmada', 'success');
      }
    }else{
      toast('Pre-reserva cancelada');
    }
  }catch(err){ showError(err); }
}

/* Al confirmar una pre-reserva: redirige a Habitaciones y deja
   resaltada la habitación que el servidor asignó (la libre del mismo
   tipo más cercana a recepción, sin bloqueos de 12 h solapados). */
function gotoHabitaciones(){
  $('#room-filter').value = '';
  roomCategoriaFiltro = ''; roomEstadoFiltro = '';
  $$('#filter-tipo .pill-btn').forEach(b=>b.classList.remove('active'));
  $$('#filter-estado .pill-btn').forEach(b=>b.classList.remove('active'));
  document.querySelector('.navlist button[data-view="habitaciones"]').click();
}

function resaltarHabitacion(room){
  const card = $(`.room-card[data-id="${room.id}"]`);
  if (!card) return;
  card.scrollIntoView({ behavior:'smooth', block:'center' });
  card.classList.add('room-pulse');
  setTimeout(()=> card.classList.remove('room-pulse'), 3000);
}

/* ------------------------------------------------------------
   CRONOGRAMA SEMANAL (7 días × 24 h) — ocupación + pre-reservas
   ------------------------------------------------------------ */
const addDaysISO = (iso, n) => {
  const d = new Date(iso + 'T12:00:00');
  d.setDate(d.getDate() + n);
  const f = x => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${f(d.getMonth()+1)}-${f(d.getDate())}`;
};
const mondayOf = iso => addDaysISO(iso, -((new Date(iso+'T12:00:00').getDay() + 6) % 7));
const semanaLabel = iso => {
  const a = new Date(iso + 'T12:00:00'), b = new Date(addDaysISO(iso, 6) + 'T12:00:00');
  return `${a.toLocaleDateString('es-PE',{weekday:'short'})} ${a.getDate()} – ${b.toLocaleDateString('es-PE',{weekday:'short'})} ${b.getDate()} ${b.toLocaleDateString('es-PE',{month:'short'})}`;
};

let schedFrom = mondayOf(todayISO());

const schedClass = it => it.kind === 'estancia'
  ? (it.estado === 'finalizada' ? 'sched-bar-fin' : 'sched-bar-est')
  : (it.estado === 'confirmada' ? 'sched-bar-conf' : 'sched-bar-pend');
const schedTitulo = it => it.kind === 'estancia'
  ? `Hab. ${it.numero} · ${it.nombres || ''} ${it.apellidos || ''}`.trim()
  : `${it.numero ? `Hab. ${it.numero} · ` : ''}${it.tipo_habitacion} · ${it.nombre || ''} · ${it.codigo}`;

/** Posición de un inicio/fin (fecha o ISO con hora) en minutos desde el
    lunes 00:00 de la semana, usando horas locales. */
const WEEK_MIN = 7 * 1440;
function minOfWeek(from, s){
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(s || '');
  const d = new Date(dateOnly ? s + 'T00:00:00' : s);
  if (isNaN(d)) return NaN;
  const f = new Date(from + 'T00:00:00');
  const mid = x => new Date(x.getFullYear(), x.getMonth(), x.getDate());
  return Math.round((mid(d) - mid(f)) / 86400000) * 1440 + d.getHours() * 60 + d.getMinutes();
}

function colocarBarras(items){
  const rango = items.map(it => {
    const s = minOfWeek(schedFrom, it.inicio);
    // Las reservas ocupan 12 h exactas desde la hora de ingreso; las
    // estancias ocupan sus días completos [inicio, fin).
    const e = it.kind === 'estancia' ? minOfWeek(schedFrom, it.fin) : s + 720;
    return { it, s: Math.max(0, s), e: Math.min(WEEK_MIN, Math.max(s, e)) };
  }).filter(b => Number.isFinite(b.s) && b.e > b.s && b.s < WEEK_MIN)
    .sort((a, b) => a.s - b.s);

  // Asigna "carriles" por solape: cada barra usa el primer carril que ya
  // terminó antes de su inicio (coloración greedy de intervalos).
  const fins = [];
  const puesto = rango.map(b => {
    let lane = fins.findIndex(f => f <= b.s);
    if (lane === -1){ lane = fins.length; fins.push(b.e); } else { fins[lane] = b.e; }
    return { b, lane };
  });
  const maxLanes = Math.max(1, fins.length);

  return puesto.map(p => {
    const span = p.b.e - p.b.s;
    const pct = span / WEEK_MIN * 100;
    const sub = pct / maxLanes;
    const left = p.b.s / WEEK_MIN * 100 + p.lane * sub;
    const width = Math.max(pct - p.lane * sub, 0.4);
    return { it: p.b.it, left, width };
  });
}

async function renderCronograma(){
  const wrap = $('#sched-wrap');
  if (!wrap) return;
  try{
    const { estancias, reservas } = await api(`/schedule?from=${schedFrom}`);
    $('#sched-range').textContent = semanaLabel(schedFrom);

    const hoy = todayISO();
    const dias = Array.from({ length: 7 }, (_, i) => addDaysISO(schedFrom, i));
    const horas = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0') + ':00');

    const items = [
      ...reservas.map(r => ({ kind: 'reserva', estado: r.estado, inicio: r.inicio, fin: r.fin, tipo_habitacion: r.tipo_habitacion, nombre: r.nombre, codigo: r.codigo, numero: r.numero, id: r.id })),
      ...estancias.map(s => ({ kind: 'estancia', estado: s.estado, inicio: s.inicio, fin: s.fin, numero: s.numero, nombres: s.nombres, apellidos: s.apellidos })),
    ];
    const barras = colocarBarras(items);

    wrap.innerHTML = `
      <div class="sched-grid">
        <div class="sched-gutter">${horas.map(h => `<span>${h}</span>`).join('')}</div>
        <div class="sched-track">
          <div class="sched-cols">
            ${dias.map(d => `
              <div class="sched-day">
                <div class="sched-day-head${d === hoy ? ' is-today' : ''}">
                  <b>${new Date(d + 'T12:00:00').toLocaleDateString('es-PE',{weekday:'short', day:'2-digit', month:'short'}).replace('.','')}</b>
                </div>
                <div class="sched-day-body"></div>
              </div>`).join('')}
          </div>
          <div class="sched-bars">
            ${barras.length ? barras.map(b => `
              <div class="sched-bar ${schedClass(b.it)}" style="left:${b.left}%;width:${b.width}%;" title="${escapeHTML(`${schedTitulo(b.it)} — ${fmtDT(b.it.inicio)} → ${fmtDT(b.it.fin)} (${b.it.estado})`)}">
                <div class="sched-bar-lbl">
                  <b>${escapeHTML(schedTitulo(b.it))}</b>
                  <small>${b.it.numero ? `Hab. ${b.it.numero} · ` : ''}${fmtDT(b.it.inicio)} → ${fmtDT(b.it.fin)}</small>
                </div>
              </div>`).join('') :
              `<p class="sched-empty">Sin ocupación ni pre-reservas en esta semana.</p>`}
          </div>
        </div>
      </div>
      <div class="sched-legend">
        <span class="lg lg-est">Ocupada</span>
        <span class="lg lg-conf">Confirmada</span>
        <span class="lg lg-pend">En espera</span>
        <span class="lg lg-fin">Finalizada</span>
      </div>`;
  }catch(err){ wrap.innerHTML = `<p class="empty-note">No se pudo cargar el cronograma: ${escapeHTML(err.message)}</p>`; }
}

$('#sched-prev').addEventListener('click', () => { schedFrom = addDaysISO(schedFrom, -7); renderReservas(); });
$('#sched-next').addEventListener('click', () => { schedFrom = addDaysISO(schedFrom, 7); renderReservas(); });
$('#sched-today').addEventListener('click', () => { schedFrom = mondayOf(todayISO()); renderReservas(); });

/* Buscar una reserva por su código de referencia (los 6 primeros del id). */
async function buscarReserva(){
  const input = $('#res-codigo');
  const cod = input.value.trim().toUpperCase();
  if (!cod){ toast('Escribe el código de referencia.', true); return; }
  try{
    const { reservations } = await api('/reservations');
    const r = reservations.find(x => x.id.slice(0, 6).toUpperCase() === cod);
    const box = $('#res-found');
    if (!r){
      box.innerHTML = `<p class="empty-note">No se encontró ninguna reserva con el código ${escapeHTML(cod)}.</p>`;
      return;
    }
    box.innerHTML = `
      <div class="res-found">
        <div>
          <p><b>${escapeHTML(r.nombre)}</b> · ${escapeHTML(r.tipo_habitacion)}${r.room_numero ? ` · Hab. ${escapeHTML(r.room_numero)}` : ''} · ${fmtDT(r.inicio)} → ${fmtDT(r.fin)}${pillEstado[r.estado]}</p>
        </div>
        <div class="res-found-acciones">
          ${contactoReserva(r)}
          ${r.estado === 'pendiente' ? `<button class="btn btn-sm btn-gold" data-fnd-confirm>Confirmar</button>` : ''}
          ${r.estado === 'pendiente' ? `<button class="btn btn-sm btn-danger" data-fnd-cancel>Cancelar</button>` : ''}
        </div>
      </div>`;
    const conf = box.querySelector('[data-fnd-confirm]'); if (conf) conf.onclick = () => setReservaEstado(r.id, 'confirmada', r.tipo_habitacion);
    const canc = box.querySelector('[data-fnd-cancel]'); if (canc) canc.onclick = () => setReservaEstado(r.id, 'cancelada');
  }catch(err){ showError(err); }
}
$('#res-buscar').addEventListener('click', buscarReserva);
$('#res-codigo').addEventListener('keydown', e => { if (e.key === 'Enter') buscarReserva(); });

/* ------------------------------------------------------------
   INVENTARIO
   ------------------------------------------------------------ */
async function renderInventario(){
  try{
    const [{ inventory }, ganancias] = await Promise.all([ api('/inventory'), api('/inventory/ganancias') ]);
    const totalProductos = inventory.length;
    const totalUnidades = inventory.reduce((a,b)=>a+Number(b.stock),0);
    const stockBajo = inventory.filter(p=>Number(p.stock)<=Number(p.stock_minimo));
    const valorInventario = inventory.reduce((a,b)=>a+Number(b.stock)*Number(b.precio),0);

    $('#kpi-inventario').innerHTML = `
      ${kpi('Productos activos', totalProductos, 'En catálogo', '', 'inventario')}
      ${kpi('Unidades en stock', totalUnidades, 'Suma de todo el inventario', '', 'venta')}
      ${kpi('Valor de inventario', money(valorInventario), 'A precio de venta', '', 'wallet')}
      ${kpi('Stock bajo', stockBajo.length, stockBajo.length? escapeHTML(stockBajo.map(p=>p.nombre).slice(0,2).join(', ')) : 'Todo en orden', stockBajo.length? 'danger-border':'', 'incidencia')}
    `;

    // Sección aparte de "Ganancias": valor a precio de costo (de
    // mercado/compra) vs. a precio de venta, la ganancia si vendieras
    // todo el stock actual, el margen promedio, y lo que ya se ganó
    // realmente en ventas hechas (histórico, con precios de cada momento).
    $('#kpi-ganancias').innerHTML = `
      ${kpi('Valor a precio de costo', money(ganancias.valorCosto), 'Lo que costó reponer el stock actual', '', 'wallet')}
      ${kpi('Ganancia potencial', money(ganancias.gananciaPotencial), 'Si vendieras todo el stock de hoy', '', 'finanzas')}
      ${kpi('Margen promedio', ganancias.margenPromedio.toFixed(1)+'%', 'Ganancia sobre el costo invertido', '', 'resumen')}
      ${kpi('Ganancia acumulada (ventas)', money(ganancias.gananciaHistorica), `De ${money(ganancias.ingresosPorVentas)} vendidos en total`, '', 'venta')}
    `;
    animarKpis($('#kpi-inventario')); animarKpis($('#kpi-ganancias'));

    $('#tbl-inventario').innerHTML = inventory.map(p=>{
      const low = Number(p.stock) <= Number(p.stock_minimo);
      const pct = Math.max(4, Math.min(100, Math.round((Number(p.stock)/Math.max(Number(p.stock_minimo)*3,1))*100)));
      return `
        <tr>
          <td>${escapeHTML(p.nombre)}<div class="stock-bar"><div class="stock-fill ${low?'low':''}" style="width:${pct}%"></div></div></td>
          <td>${escapeHTML(p.categoria||'—')}</td>
          <td>${low? `<span class="pill pill-danger">${p.stock} unid.</span>` : `<span class="pill pill-ok">${p.stock} unid.</span>`}</td>
          <td>${money(p.precio)}<br><small style="color:var(--ink-600);">Costo: ${money(p.costo||0)}</small></td>
          <td>
            <div style="display:flex;gap:6px;align-items:center;">
              <input type="number" class="qty-input" min="1" max="${p.stock}" value="1" aria-label="Cantidad a vender" id="qty-${p.id}" ${p.stock<=0?'disabled':''}>
              <button class="btn btn-sm btn-gold" data-sell="${p.id}" ${p.stock<=0?'disabled':''}>Vender</button>
            </div>
          </td>
          <td>${session.role==='admin' ? `<button class="btn btn-sm btn-danger" data-del="${p.id}">Eliminar</button>` : ''}</td>
        </tr>`;
    }).join('') || `<tr><td colspan="6" class="empty-note">Sin productos registrados.</td></tr>`;

    $$('button[data-sell]').forEach(btn=> btn.addEventListener('click', ()=> sellProduct(btn.dataset.sell)));
    $$('button[data-del]').forEach(btn=> btn.addEventListener('click', async ()=>{
      const prod = inventory.find(p=>p.id===btn.dataset.del);
      const ok = await confirmDialog({ title:`¿Eliminar "${prod ? prod.nombre : 'producto'}"?`, message:'Dejará de aparecer en el catálogo. Sus ventas pasadas se conservan en el historial y en las ganancias.', confirmText:'Sí, eliminar' });
      if(!ok) return;
      try{ await api(`/inventory/${btn.dataset.del}`, { method:'DELETE' }); renderAll(); toast('Producto eliminado del catálogo', 'success'); }
      catch(err){ showError(err); }
    }));
  }catch(err){ showError(err); }
}

function sellProduct(id){
  const qty = Math.max(1, parseInt($('#qty-'+id)?.value||'1',10));
  openQaVenta(id, qty);
}

$('#btn-add-inv').addEventListener('click', async ()=>{
  const nombre = $('#inv-nombre').value.trim();
  if(!nombre){ toast('Ingresa el nombre del producto', true); return; }
  try{
    // Si el producto ya existe (mismo nombre), el servidor NO crea uno
    // duplicado: le suma el stock indicado al que ya existía. Antes esto
    // creaba un producto repetido — ver inventory.controller.js.
    const data = await api('/inventory', { method:'POST', body:{
      nombre, categoria: $('#inv-categoria').value.trim(),
      stock: Number($('#inv-stock').value||0), stock_minimo: Number($('#inv-minstock').value||0),
      precio: Number($('#inv-precio').value||0), costo: Number($('#inv-costo').value||0),
    }});
    $('#inv-nombre').value=''; $('#inv-categoria').value=''; $('#inv-stock').value=''; $('#inv-minstock').value=''; $('#inv-precio').value=''; $('#inv-costo').value='';
    renderAll();
    toast(data.yaExistia ? data.mensaje : 'Producto agregado al inventario', 'success');
  }catch(err){ showError(err); }
});

/* ============================================================
   ACCIONES RÁPIDAS (Resumen) — modales conectadas al backend real:
   ingreso de stock, gasto y venta. "Incidencias" es demo (mock).
   ============================================================ */
$('#btn-qa-ingreso').addEventListener('click', openQaIngreso);
$('#btn-qa-gasto').addEventListener('click', openQaGasto);
$('#btn-qa-venta').addEventListener('click', openQaVenta);
$('#btn-qa-incidencia').addEventListener('click', openQaIncidencias);
$('#btn-emp-incidencia').addEventListener('click', openQaIncidencias);

async function openQaIngreso(){
  if(session.role!=='admin'){ toast('Solo el administrador puede ingresar productos al stock', true); return; }
  try{
    const { inventory } = await api('/inventory');
    if(!inventory.length){ toast('No hay productos registrados', true); return; }
    openModal(`
      <h3>Ingreso de productos</h3>
      <p class="modal-sub">Aumenta el stock de un producto existente (queda auditado como ajuste).</p>
      <div class="field"><label>Producto</label>
        <select id="qa-ing-producto">${inventory.map(p=>`<option value="${p.id}">${escapeHTML(p.nombre)} · stock actual: ${p.stock}</option>`).join('')}</select>
      </div>
      <div class="field"><label>Cantidad a ingresar</label><input id="qa-ing-cantidad" type="number" min="1" step="1" value="1"></div>
      <div class="modal-actions">
        <button class="btn" id="modal-cancel">Cancelar</button>
        <button class="btn btn-gold" id="qa-ing-ok">Ingresar al stock</button>
      </div>`);
    $('#modal-cancel').onclick = closeModal;
    $('#qa-ing-ok').onclick = async ()=>{
      const cantidad = parseInt($('#qa-ing-cantidad').value||'1', 10);
      const id = $('#qa-ing-producto').value;
      if(!cantidad || cantidad < 1){ toast('Cantidad inválida', true); return; }
      try{
        await api(`/inventory/${id}/adjust`, { method:'POST', body:{ delta: cantidad } });
        closeModal(); renderResumen();
        toast(`+${cantidad} unidades ingresadas al stock`, 'success');
      }catch(err){ showError(err); }
    };
  }catch(err){ showError(err); }
}

async function openQaGasto(){
  openModal(`
    <h3>Registrar gasto</h3>
    <p class="modal-sub">Un egreso sale de la caja y se descuenta en el cierre, según cómo se pagó.</p>
    <div class="field"><label>Concepto</label><input id="qa-gas-concepto" type="text" maxlength="120" placeholder="Ej. Compra de insumos de limpieza"></div>
    <div class="field"><label>Monto (S/)</label><input id="qa-gas-monto" type="number" min="0.01" step="0.10" placeholder="0.00"></div>
    <div class="field"><label>Método de pago</label>
      <select id="qa-gas-metodo">${METODOS.map(m=>`<option>${m}</option>`).join('')}</select>
    </div>
    <div class="modal-actions">
      <button class="btn" id="modal-cancel">Cancelar</button>
      <button class="btn btn-gold" id="qa-gas-ok">Registrar gasto</button>
    </div>`);
  $('#modal-cancel').onclick = closeModal;
  $('#qa-gas-ok').onclick = async ()=>{
    const concepto = $('#qa-gas-concepto').value.trim();
    const monto = Number($('#qa-gas-monto').value);
    if(!concepto || !monto || monto<=0){ toast('Completa concepto y monto válido', true); return; }
    try{
      await api('/finance', { method:'POST', body:{ tipo:'egreso', concepto, monto, metodo: $('#qa-gas-metodo').value } });
      closeModal(); renderAll();
      toast('Gasto registrado', 'success');
    }catch(err){ showError(err); }
  };
}

async function openQaVenta(productoId, cantidadInicial = 1){
  try{
    const { inventory } = await api('/inventory');
    const vendibles = inventory.filter(p=>Number(p.stock)>0);
    if(!vendibles.length){ toast('No hay productos con stock para vender', true); return; }
    openModal(`
      <h3>Registrar venta</h3>
      <p class="modal-sub">Descuenta el stock y suma el ingreso a caja con su forma de pago.</p>
      <div class="modal-grid">
        <div class="field"><label>Producto</label>
          <select id="qa-ven-producto">${vendibles.map(p=>`<option value="${p.id}" data-precio="${p.precio}" data-stock="${p.stock}">${escapeHTML(p.nombre)} · ${money(p.precio)} (stock ${p.stock})</option>`).join('')}</select>
        </div>
        <div class="field"><label>Cantidad</label><input id="qa-ven-cantidad" type="number" min="1" step="1" value="${cantidadInicial}"></div>
      </div>
      <div id="qa-ven-cobro"></div>
      <div class="modal-actions">
        <button class="btn" id="modal-cancel">Cancelar</button>
        <button class="btn btn-gold" id="qa-ven-ok">${icon('venta', 15)} Cobrar venta</button>
      </div>`, { wide: true });
    if (productoId && vendibles.some(p=>p.id===productoId)) $('#qa-ven-producto').value = productoId;
    const totalActual = ()=>{
      const op = $('#qa-ven-producto').selectedOptions[0];
      const n = Math.max(1, parseInt($('#qa-ven-cantidad').value||'1', 10));
      return Number(op.dataset.precio || 0) * n;
    };
    const cobro = crearCobro($('#qa-ven-cobro'), { total: totalActual(), comprobante: 'ninguno' });
    $('#modal-cancel').onclick = closeModal;
    ['#qa-ven-cantidad','#qa-ven-producto'].forEach(s => $(s).addEventListener(s.endsWith('producto') ? 'change' : 'input', ()=> cobro.setTotal(totalActual())));
    $('#qa-ven-ok').onclick = async ()=>{
      const cantidad = parseInt($('#qa-ven-cantidad').value||'1', 10);
      const op = $('#qa-ven-producto').selectedOptions[0];
      if(!cantidad || cantidad < 1){ toast('Cantidad inválida', true); return; }
      if(cantidad > Number(op.dataset.stock)){ toast(`Solo quedan ${op.dataset.stock} unidad(es)`, true); return; }
      let datos;
      try { datos = cobro.leer(); } catch (e) { toast(e.message, true); return; }
      try{
        const res = await api(`/inventory/${op.value}/sell`, { method:'POST', body:{ cantidad, ...datos } });
        renderAll();
        mostrarCobroExitoso({ titulo: 'Venta registrada', total: res.monto, pagos: res.pagos, comprobante: res.comprobante, vuelto: res.comprobante ? res.comprobante.vuelto : null });
      }catch(err){ showError(err); }
    };
  }catch(err){ showError(err); }
}

/* ============================================================
   INCIDENCIAS — modal de acciones rápidas, conectado al backend.
   Ciclo de estado: abierta → en_revision → resuelta → reabrir.
   ============================================================ */
const INC_TIPOS = ['Fuga de agua','Problema eléctrico','Daño en mobiliario','Vidrio roto','Wi-Fi / Televisión','Aire acondicionado / Ventilador','Cerradura','Limpieza','Plagas','Ruido','Otro'];
const INC_LUGARES = ['Recepción','Pasillo','Sala común','Cocina','Lavandería','Patio / Jardín','Estacionamiento','Otro'];
const INC_ESTADOS = {
  abierta:     { label:'Abierta',      pill:'pill-warn',   next:'en_revision', btn:'Pasar a revisión' },
  en_revision: { label:'En revisión',  pill:'pill-danger', next:'resuelta',    btn:'Marcar resuelta' },
  resuelta:    { label:'Resuelta',     pill:'pill-ok',     next:'abierta',     btn:'Reabrir' },
};

function fmtDateTime(iso){
  const d = new Date(iso);
  const fecha = d.toLocaleDateString('es-PE',{day:'2-digit',month:'short'});
  const hora = d.toLocaleTimeString('es-PE',{hour:'2-digit',minute:'2-digit',hour12:false});
  return `${fecha} · ${hora}`;
}

function incidenciasHTML(list){
  if(!list.length) return `<div class="side-empty">${icon('incidencia',26)}<p>No hay incidencias registradas.</p></div>`;
  return `<div class="side-list">${list.map(i=>{
    const st = INC_ESTADOS[i.estado] || INC_ESTADOS.abierta;
    const donde = [i.habitacion_num ? ('Hab. '+i.habitacion_num) : null, i.ubicacion].filter(Boolean).join(' · ');
    return `<div class="side-item">
      <div class="side-item-title"><span class="pill ${st.pill}">${st.label}</span> ${escapeHTML(i.tipo)}</div>
      <div class="side-item-sub">${escapeHTML(donde)} · ${escapeHTML(i.reportado_por)} · ${fmtDateTime(i.created_at)}</div>
      ${i.detalle ? `<div class="side-item-sub">${escapeHTML(i.detalle)}</div>` : ''}
      <button class="side-link inc-advance" data-id="${i.id}" data-next="${st.next}">${st.btn}</button>
    </div>`;
  }).join('')}</div>`;
}

async function refreshIncidList(){
  try{
    const { incidencias } = await api('/incidencias');
    $('#inc-list').innerHTML = incidenciasHTML(incidencias);
    bindIncAdvance();
  }catch(err){ showError(err); }
}

function bindIncAdvance(){
  $$('.inc-advance').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      api(`/incidencias/${btn.dataset.id}`, { method:'PATCH', body:{ estado: btn.dataset.next } })
        .then(refreshIncidList)
        .catch(err=> showError(err));
    });
  });
}

async function openQaIncidencias(){
  try{
    const [{ rooms }, { incidencias }] = await Promise.all([api('/rooms'), api('/incidencias')]);
    openModal(`
      <h3>Incidencias</h3>
      <p class="modal-sub">Reporta averías o quejas del hostal. La hora de registro es automática.</p>
      <div class="inc-form">
        <div class="field"><label>Tipo de incidente</label>
          <select id="inc-tipo">${INC_TIPOS.map(t=>`<option>${escapeHTML(t)}</option>`).join('')}</select>
        </div>
        <div class="field"><label>Habitación</label>
          <select id="inc-habitacion"><option value="">— Zona general —</option>${rooms.map(r=>`<option>${escapeHTML(r.numero)}</option>`).join('')}</select>
        </div>
        <div class="field"><label>Lugar del hostal</label>
          <select id="inc-ubicacion">${INC_LUGARES.map(l=>`<option>${escapeHTML(l)}</option>`).join('')}</select>
        </div>
        <div class="field inc-detalle"><label>Detalle</label>
          <textarea id="inc-detalle" maxlength="500" rows="2" placeholder="Describe brevemente lo ocurrido…"></textarea>
        </div>
        <button class="btn btn-gold" id="inc-submit">${icon('incidencia', 13)} Registrar incidencia</button>
      </div>
      <div class="inc-list" id="inc-list">${incidenciasHTML(incidencias)}</div>
      <div class="modal-actions"><button class="btn" id="modal-cancel">Cerrar</button></div>`);
    $('#modal-cancel').onclick = closeModal;
    $('#inc-submit').onclick = async ()=>{
      const tipo = $('#inc-tipo').value;
      const ubicacion = $('#inc-ubicacion').value;
      const habitacion_num = $('#inc-habitacion').value;
      const detalle = $('#inc-detalle').value.trim();
      if(!tipo || !ubicacion){ toast('Completa el tipo y el lugar', true); return; }
      try{
        await api('/incidencias', { method:'POST', body:{ tipo, ubicacion, habitacion_num, detalle } });
        $('#inc-detalle').value='';
        await refreshIncidList();
        toast('Incidencia registrada', 'success');
      }catch(err){ showError(err); }
    };
    bindIncAdvance();
  }catch(err){ showError(err); }
}

/* ============================================================
   PANEL LATERAL (Resumen) — pestañas Pedidos / Reservas / Notas.
   Pedidos es mock; Reservas y Notas usan el backend real.
   ============================================================ */
let sideTab = 'pedidos';
function sideEmpty(msg){ return `<div class="side-empty">${icon('nota', 26)}<p>${escapeHTML(msg)}</p></div>`; }

async function renderSidePanel(){
  const body = $('#side-body');
  if(!body) return;

  if(sideTab === 'pedidos'){
    // ponytail: sin backend de pedidos aún → estado vacío.
    body.innerHTML = sideEmpty('No hay pedidos pendientes');
  } else if(sideTab === 'reservas'){
    try{
      const { reservations } = await api('/reservations?estado=pendiente');
      if(!reservations.length){ body.innerHTML = sideEmpty('No hay pre-reservas pendientes'); return; }
      body.innerHTML = `
        <div class="side-list">${reservations.slice(0,5).map(r=>`
          <div class="side-item">
            <div class="side-item-title">${escapeHTML(r.nombre)}<small>${escapeHTML(r.tipo_habitacion)}</small></div>
            <div class="side-item-sub">${fmtDate(r.checkin)} → ${fmtDate(r.checkout)}</div>
          </div>`).join('')}
        </div>
        <button class="side-link" id="side-ver-reservas">Ver todas en Reservas</button>`;
      $('#side-ver-reservas').addEventListener('click', ()=>{ document.querySelector('.navlist button[data-view="reservas"]').click(); });
    }catch(err){ body.innerHTML = sideEmpty('No se pudieron cargar las pre-reservas'); }
  } else { // notas
    try{
      const { notas } = await api('/notas');
      body.innerHTML = `
        <div class="side-note-form">
          <input type="text" id="nota-input" maxlength="500" placeholder="Añadir nota…" autocomplete="off">
          <button class="side-link side-note-add" id="nota-add">${icon('nota', 13)} Añadir</button>
        </div>
        ${notas.length
          ? `<div class="side-list">${notas.map(n=>`
              <div class="side-item">
                <div class="side-item-title">${escapeHTML(n.texto)}</div>
                <div class="side-item-sub">${escapeHTML(n.autor)} · ${fmtDate(n.created_at)}</div>
              </div>`).join('')}
            </div>`
          : sideEmpty('No hay notas aún. Escribe la primera arriba.')}`;
      const input = $('#nota-input');
      const add = () => {
        const texto = input.value.trim();
        if(!texto){ return; }
        api('/notas', { method:'POST', body:{ texto } })
          .then(()=>{ renderSidePanel(); })
          .catch(err=> showError(err));
      };
      $('#nota-add').addEventListener('click', add);
      input.addEventListener('keydown', e=>{ if(e.key==='Enter') add(); });
    }catch(err){ body.innerHTML = sideEmpty('No se pudieron cargar las notas'); }
  }
}

$$('#side-panel .side-tabs button').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    $$('#side-panel .side-tabs button').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    sideTab = btn.dataset.side;
    renderSidePanel();
  });
});

/* ============================================================
   CONTROL DE EMPLEADOS
   ---------------------------------------------------------------
   El administrador registra cuántas habitaciones limpió la señora
   de limpieza (u otro colaborador) cada día, con observaciones. Las
   incidencias del hostal (averías/quejas) se muestran justo debajo,
   reutilizando el mismo módulo que ya existe en Acciones rápidas,
   para tener en un solo lugar "todo lo que pasó con el personal y
   el local".
   ============================================================ */
async function renderEmpleados(){
  try{
    const [{ logs }, { resumen }, { incidencias }] = await Promise.all([
      api('/employees/logs'), api('/employees/summary'), api('/incidencias'),
    ]);

    $('#kpi-empleados').innerHTML = `
      ${kpi('Habitaciones limpiadas (30 días)', resumen.reduce((a,b)=>a+Number(b.total_habitaciones||0),0), resumen.length? resumen.map(r=>`${escapeHTML(r.empleado)}: ${r.total_habitaciones}`).join(' · ') : 'Sin registros aún', '', 'habitaciones')}
      ${kpi('Horas trabajadas (30 días)', resumen.reduce((a,b)=>a+Number(b.total_horas||0),0).toFixed(1)+' h', resumen.length? resumen.map(r=>`${escapeHTML(r.empleado)}: ${r.total_horas.toFixed(1)}h`).join(' · ') : 'Sin registros aún', '', 'reservas')}
      ${kpi('Incidencias abiertas', incidencias.filter(i=>i.estado!=='resuelta').length, 'Averías o quejas por resolver', incidencias.some(i=>i.estado!=='resuelta')?'danger-border':'', 'incidencia')}
    `;

    animarKpis($('#kpi-empleados'));
    $('#tbl-empleados').innerHTML = logs.map(l=>`
      <tr>
        <td>${fmtDate(l.fecha)}</td>
        <td>${escapeHTML(l.empleado)}</td>
        <td>${escapeHTML(l.hora_ingreso||'—')}</td>
        <td>${escapeHTML(l.hora_salida||'—')}</td>
        <td>${l.horas!=null ? l.horas.toFixed(2)+' h' : '—'}</td>
        <td><span class="pill pill-ok">${l.habitaciones} habitación(es)</span></td>
        <td>${escapeHTML(l.notas||'—')}</td>
        <td>${escapeHTML(l.registrado_por)}</td>
        <td>${session.role==='admin' ? `<button class="btn btn-sm btn-danger" data-emp-del="${l.id}">Eliminar</button>` : ''}</td>
      </tr>
    `).join('') || `<tr><td colspan="9" class="empty-note">Aún no hay jornadas registradas.</td></tr>`;

    $$('button[data-emp-del]').forEach(btn=> btn.addEventListener('click', async ()=>{
      const ok = await confirmDialog({ title:'¿Eliminar este registro?', message:'La jornada se borrará del historial del colaborador.', confirmText:'Sí, eliminar' });
      if(!ok) return;
      try{ await api(`/employees/logs/${btn.dataset.empDel}`, { method:'DELETE' }); renderEmpleados(); toast('Registro eliminado', 'success'); }
      catch(err){ showError(err); }
    }));

    $('#inc-empleados-list').innerHTML = incidenciasHTML(incidencias);
    $$('#inc-empleados-list .inc-advance').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        api(`/incidencias/${btn.dataset.id}`, { method:'PATCH', body:{ estado: btn.dataset.next } })
          .then(renderEmpleados).catch(err=> showError(err));
      });
    });
  }catch(err){ showError(err); }
}

$('#btn-add-emp')?.addEventListener('click', async ()=>{
  if(session.role!=='admin'){ toast('Solo el administrador registra jornadas de limpieza', true); return; }
  const empleado = $('#emp-nombre').value.trim();
  const habitaciones = Number($('#emp-habitaciones').value||0);
  if(!empleado){ toast('Escribe el nombre del colaborador', true); return; }
  try{
    await api('/employees/logs', { method:'POST', body:{
      empleado, fecha: $('#emp-fecha').value || todayISO(),
      hora_ingreso: $('#emp-hora-ingreso').value || null,
      hora_salida: $('#emp-hora-salida').value || null,
      habitaciones, notas: $('#emp-notas').value.trim(),
    }});
    $('#emp-nombre').value=''; $('#emp-hora-ingreso').value=''; $('#emp-hora-salida').value=''; $('#emp-habitaciones').value=''; $('#emp-notas').value='';
    renderEmpleados();
    toast('Jornada registrada', 'success');
  }catch(err){ showError(err); }
});

/* ============================================================
   CONFIGURACIÓN — el usuario cambia su nombre, usuario, foto y
   contraseña. Todo pasa por PATCH /api/auth/me; el token se
   renueva automáticamente para que el panel refleje el cambio sin
   pedir un nuevo inicio de sesión.
   ============================================================ */
let avatarPendiente = null; // dataURL nueva foto (aún no guardada)

/* Redimensiona la imagen elegida a un cuadrado pequeño en el propio
   navegador antes de mandarla al servidor — así una foto de 8 MB del
   celular no se manda entera, solo un avatar liviano en base64. */
function leerYRedimensionarImagen(file){
  return new Promise((resolve, reject)=>{
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const size = 240;
        const canvas = document.createElement('canvas');
        canvas.width = size; canvas.height = size;
        const ctx = canvas.getContext('2d');
        const s = Math.min(img.width, img.height);
        const sx = (img.width - s) / 2, sy = (img.height - s) / 2;
        ctx.drawImage(img, sx, sy, s, s, 0, 0, size, size);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function renderConfiguracion(){
  try{
    const { user } = await api('/auth/me');
    $('#cfg-nombre').value = user.nombre;
    $('#cfg-username').value = user.username;
    $('#cfg-role').value = user.role==='admin' ? 'Administrador' : 'Recepcionista';
    avatarPendiente = null;
    avatarInto($('#cfg-avatar-preview'), user.foto, user.nombre);
    session.passwordPorDefecto = !!user.passwordPorDefecto;
    renderAlertas();
    $('#cfg-pass-actual').value = ''; $('#cfg-pass-nueva').value=''; $('#cfg-pass-confirma').value='';
  }catch(err){ showError(err); }
}

$('#cfg-avatar-input')?.addEventListener('change', async (e)=>{
  const file = e.target.files[0];
  if(!file) return;
  if(!/^image\/(png|jpe?g|webp)$/.test(file.type)){ toast('Elige una imagen JPG, PNG o WebP', true); return; }
  if(file.size > 15 * 1024 * 1024){ toast('La imagen es demasiado pesada (máx. 15 MB)', true); return; }
  try{
    avatarPendiente = await leerYRedimensionarImagen(file);
    avatarInto($('#cfg-avatar-preview'), avatarPendiente, session.nombre);
  }catch(err){ toast('No se pudo procesar la imagen', true); }
});

$('#btn-cfg-guardar')?.addEventListener('click', async ()=>{
  const nombre = $('#cfg-nombre').value.trim();
  const username = $('#cfg-username').value.trim();
  const passNueva = $('#cfg-pass-nueva').value;
  const passConfirma = $('#cfg-pass-confirma').value;
  const passActual = $('#cfg-pass-actual').value;

  if(!nombre || !username){ toast('Nombre y usuario son obligatorios', true); return; }
  if(passNueva && passNueva.length < 8){ toast('La nueva contraseña debe tener al menos 8 caracteres', true); return; }
  if(passNueva && passNueva !== passConfirma){ toast('La nueva contraseña y su confirmación no coinciden', true); return; }
  if(passNueva && !passActual){ toast('Escribe tu contraseña actual para poder cambiarla', true); return; }

  const body = { nombre, username };
  if(avatarPendiente) body.foto = avatarPendiente;
  if(passNueva){ body.password_actual = passActual; body.password_nueva = passNueva; }

  try{
    const data = await api('/auth/me', { method:'PATCH', body });
    setSession(data.token, data.user);
    session = data.user;
    $('#user-name').textContent = session.nombre;
    renderUserAvatar();
    renderConfiguracion();
    toast('Datos actualizados correctamente', 'success');
  }catch(err){ showError(err); }
});

/* Medidor de fuerza de la nueva contraseña (solo orientativo: la regla real
   la aplica el servidor). */
$('#cfg-pass-nueva')?.addEventListener('input', e=>{
  const v = e.target.value;
  let score = 0;
  if (v.length >= 8) score++;
  if (v.length >= 12) score++;
  if (/[a-z]/.test(v) && /[A-Z]/.test(v)) score++;
  if (/\d/.test(v)) score++;
  if (/[^A-Za-z0-9]/.test(v)) score++;
  const niveles = [
    { w: 0,   c: 'transparent', t: 'Mínimo 8 caracteres. Combina letras, números y símbolos.' },
    { w: 25,  c: '#D26464', t: 'Débil' },
    { w: 45,  c: '#E1A94A', t: 'Aceptable' },
    { w: 70,  c: '#C9A227', t: 'Buena' },
    { w: 88,  c: '#3A9068', t: 'Fuerte' },
    { w: 100, c: '#2F7A56', t: 'Excelente' },
  ];
  const n = v ? (v.length < 8 ? niveles[1] : niveles[Math.min(5, score)]) : niveles[0];
  $('#pass-meter-bar').style.width = n.w + '%';
  $('#pass-meter-bar').style.background = n.c;
  $('#pass-meter-lbl').textContent = v && v.length < 8 ? `Muy corta (${v.length}/8)` : n.t;
});

/* ============================================================
   ARRANQUE
   ============================================================ */
(function iniciar(){
  let expirada = false;
  try { expirada = sessionStorage.getItem(EXPIRED_KEY) === '1'; sessionStorage.removeItem(EXPIRED_KEY); } catch (_) { /* sin storage */ }

  if (session && getToken()) {
    enterApp();
  } else {
    clearSession();
    session = null;
    if (expirada) {
      $('#login-error').textContent = 'Tu sesión expiró o se cerró desde otro equipo. Vuelve a ingresar.';
      $('#login-error').classList.add('show');
    }
    setTimeout(()=> $('#login-user').focus(), 450);
  }
  // Oculta la pantalla de carga en cuanto la interfaz está lista.
  setTimeout(()=>{
    document.body.classList.add('ready');
    setTimeout(()=> document.getElementById('boot')?.remove(), 600);
  }, 250);
})();
