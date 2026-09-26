/**
 * public-site/js/comun.js
 * ---------------------------------------------------------------
 * Lo que comparten TODAS las páginas del sitio público:
 *   1. Datos de contacto (un solo lugar para editarlos).
 *   2. Menú de la cabecera.
 *   3. Consentimiento de cookies / almacenamiento (Ley 29733).
 *   4. Mapa de Google, que solo se carga con permiso del visitante.
 *   5. Datos del hostal en las páginas legales.
 */

/* EDITAR AQUÍ: datos de contacto del hostal. */
const DATOS_SITIO = {
  zona: 'José Olaya, Cayma · Arequipa',
  whatsapp: '51973139491',            // con código de país (51), sin espacios ni +
  whatsappVisible: '973 139 491',
  llamadas: '+51940974453',
  llamadasVisible: '940 974 453',
  horario: 'Las 24 horas, todos los días',
  facebook: 'https://www.facebook.com/profile.php?id=61594460704580',
  mapsLink: 'https://maps.app.goo.gl/GQJ4ZktxatxLCnJ49',
  mapsEmbed: 'https://www.google.com/maps?q=-16.3424305,-71.5441207&z=17&hl=es&output=embed',
};

const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const waLink = msg => `https://wa.me/${DATOS_SITIO.whatsapp}${msg ? '?text=' + encodeURIComponent(msg) : ''}`;

/* ---------- 1. Datos de contacto en la página ---------- */
const TEXTOS = {
  zona: DATOS_SITIO.zona,
  whatsapp: DATOS_SITIO.whatsappVisible,
  llamadas: DATOS_SITIO.llamadasVisible,
  horario: DATOS_SITIO.horario,
};
$$('[data-dato]').forEach(el => { el.textContent = TEXTOS[el.dataset.dato] || ''; });
const LINKS = {
  whatsapp: waLink('Hola Hostal Dorado, quisiera información sobre una habitación.'),
  llamadas: 'tel:' + DATOS_SITIO.llamadas,
  maps: DATOS_SITIO.mapsLink,
  facebook: DATOS_SITIO.facebook,
};
$$('[data-link]').forEach(el => { el.href = LINKS[el.dataset.link]; });
$$('[data-anio]').forEach(el => { el.textContent = new Date().getFullYear(); });

/* ---------- 2. Cabecera: sólida al bajar + menú móvil ---------- */
const header = $('#site-header');
if (header) {
  const solida = header.classList.contains('solid');
  const onScroll = () => header.classList.toggle('scrolled', solida || window.scrollY > 40);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
  const toggle = $('#nav-toggle'), nav = $('#site-nav');
  const cerrarMenu = () => { nav.classList.remove('open'); toggle.setAttribute('aria-expanded', 'false'); toggle.setAttribute('aria-label', 'Abrir menú'); };
  toggle.addEventListener('click', () => {
    const abierto = nav.classList.toggle('open');
    toggle.setAttribute('aria-expanded', String(abierto));
    toggle.setAttribute('aria-label', abierto ? 'Cerrar menú' : 'Abrir menú');
  });
  $$('#site-nav a').forEach(a => a.addEventListener('click', cerrarMenu));
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && nav.classList.contains('open')) { cerrarMenu(); toggle.focus(); } });
}

/* ---------- Avisos breves ---------- */
function toast(msg, isError = false){
  const box = $('#toast');
  if (!box) return;
  const el = document.createElement('div');
  el.className = 'toast' + (isError ? ' error' : '');
  el.textContent = msg;
  box.appendChild(el);
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 250); }, isError ? 5000 : 3000);
}

/* ============================================================
   3. CONSENTIMIENTO
   ------------------------------------------------------------
   El sitio NO usa cookies propias. Guarda tu elección en el
   almacenamiento local del navegador (clave "hd-consent"), que es
   estrictamente necesario para recordarla. Categorías opcionales,
   todas desactivadas hasta que el visitante las acepte:
     - mapas:     muestra el mapa de Google (Google puede usar cookies).
     - analitica: medición de visitas. Hoy NO hay ninguna herramienta
                  instalada; si algún día se agrega, debe cargarse
                  dentro de cargarAnalitica() para respetar esta elección.
   ============================================================ */
const CONSENT_KEY = 'hd-consent';
const CONSENT_VERSION = 1;

const consent = {
  leer(){
    try {
      const c = JSON.parse(localStorage.getItem(CONSENT_KEY) || 'null');
      return c && c.v === CONSENT_VERSION ? c : null;
    } catch (_) { return null; }
  },
  guardar(opciones){
    const c = { v: CONSENT_VERSION, fecha: new Date().toISOString(), mapas: !!opciones.mapas, analitica: !!opciones.analitica };
    try { localStorage.setItem(CONSENT_KEY, JSON.stringify(c)); } catch (_) { /* navegación privada: vale solo por esta visita */ }
    estadoActual = c;
    aplicarConsentimiento(c);
    document.dispatchEvent(new CustomEvent('hd:consent', { detail: c }));
    return c;
  },
};
let estadoActual = consent.leer();

function cargarAnalitica(){
  /* Punto único para una futura herramienta de analítica (p. ej. Plausible
     o Google Analytics). Solo se llama si el visitante aceptó «Analítica».
     Recuerda también permitir su dominio en la política CSP de server.js. */
}

function aplicarConsentimiento(c){
  if (c && c.mapas) $$('[data-mapa]').forEach(cargarMapa);
  if (c && c.analitica) cargarAnalitica();
}

/* ---------- Banner ---------- */
function mostrarBanner(){
  if ($('#cookie-banner')) return;
  const b = document.createElement('section');
  b.id = 'cookie-banner';
  b.className = 'cookie-banner';
  b.setAttribute('aria-label', 'Aviso de cookies');
  b.innerHTML = `
    <div class="cb-text">
      <p class="cb-title">Tu privacidad, tu decisión</p>
      <p>No usamos cookies propias. Con tu permiso mostramos el mapa de Google, que sí puede usar cookies de Google. Puedes cambiar tu elección cuando quieras en «Configurar cookies», al pie de la página. <a href="/cookies">Más información</a></p>
    </div>
    <div class="cb-actions">
      <button type="button" class="cb-btn" data-cb="rechazar">Rechazar opcionales</button>
      <button type="button" class="cb-btn" data-cb="configurar">Configurar</button>
      <button type="button" class="cb-btn cb-btn-ok" data-cb="aceptar">Aceptar todo</button>
    </div>`;
  document.body.appendChild(b);
  // El botón flotante de WhatsApp sube para no quedar tapado por el aviso.
  document.body.style.setProperty('--banner-h', (b.offsetHeight + 32) + 'px');
  document.body.classList.add('con-banner');
  requestAnimationFrame(() => b.classList.add('in'));
  b.querySelector('[data-cb="rechazar"]').onclick = () => { consent.guardar({ mapas: false, analitica: false }); cerrarBanner(); toast('Guardamos tu elección: solo lo necesario.'); };
  b.querySelector('[data-cb="aceptar"]').onclick = () => { consent.guardar({ mapas: true, analitica: true }); cerrarBanner(); toast('Guardamos tu elección.'); };
  b.querySelector('[data-cb="configurar"]').onclick = () => abrirPreferencias();
}
function cerrarBanner(){
  const b = $('#cookie-banner');
  if (!b) return;
  document.body.classList.remove('con-banner');
  b.classList.remove('in');
  setTimeout(() => b.remove(), 220);
}

/* ---------- Panel de preferencias (dialog nativo) ---------- */
function abrirPreferencias(){
  let dlg = $('#cookie-prefs');
  if (!dlg) {
    dlg = document.createElement('dialog');
    dlg.id = 'cookie-prefs';
    dlg.className = 'modal prefs';
    dlg.setAttribute('aria-labelledby', 'prefs-titulo');
    document.body.appendChild(dlg);
  }
  const c = estadoActual || { mapas: false, analitica: false };
  dlg.innerHTML = `
    <form method="dialog" class="prefs-body">
      <h2 id="prefs-titulo">Preferencias de privacidad</h2>
      <p class="prefs-intro">Elige qué permites. Lo necesario no se puede desactivar porque sin eso el sitio no funciona.</p>
      <div class="pref">
        <div><b>Necesario</b><p>Recordar esta elección en tu navegador. No identifica a nadie ni se comparte.</p></div>
        <span class="pref-fixed">Siempre activo</span>
      </div>
      <label class="pref">
        <div><b>Mapa de Google (terceros)</b><p>Muestra nuestra ubicación dentro de la página. Al cargarse, Google recibe tu dirección IP y puede usar cookies propias.</p></div>
        <input type="checkbox" class="switch" id="pref-mapas" ${c.mapas ? 'checked' : ''}>
      </label>
      <label class="pref">
        <div><b>Analítica</b><p>Contar visitas de forma agregada para mejorar el sitio. Hoy no usamos ninguna herramienta de analítica; si la activamos en el futuro, solo funcionará si lo permites aquí.</p></div>
        <input type="checkbox" class="switch" id="pref-analitica" ${c.analitica ? 'checked' : ''}>
      </label>
      <div class="modal-actions">
        <button type="button" class="btn" data-pref="rechazar">Rechazar opcionales</button>
        <button type="submit" class="btn btn-ok" data-pref="guardar">Guardar mi elección</button>
      </div>
    </form>`;
  dlg.querySelector('[data-pref="rechazar"]').onclick = () => {
    consent.guardar({ mapas: false, analitica: false });
    quitarMapas();
    cerrarDialogo(dlg); cerrarBanner();
    toast('Guardamos tu elección: solo lo necesario.');
  };
  dlg.querySelector('form').addEventListener('submit', () => {
    const mapas = dlg.querySelector('#pref-mapas').checked;
    consent.guardar({ mapas, analitica: dlg.querySelector('#pref-analitica').checked });
    if (!mapas) quitarMapas();
    cerrarBanner();
    toast('Guardamos tu elección.');
  });
  abrirDialogo(dlg);
}
$$('[data-abrir-cookies]').forEach(b => b.addEventListener('click', abrirPreferencias));

/* Abrir/cerrar <dialog> con animación y devolviendo el foco a quien lo abrió. */
function abrirDialogo(dlg){
  dlg._origen = document.activeElement;
  dlg.classList.remove('closing');
  if (!dlg.open) dlg.showModal();
  document.documentElement.classList.add('modal-abierto');
  if (!dlg._wired){
    dlg._wired = true;
    dlg.addEventListener('close', () => {
      document.documentElement.classList.remove('modal-abierto');
      if (dlg._origen && document.contains(dlg._origen)) dlg._origen.focus({ preventScroll: true });
    });
    // Clic fuera de la caja (en el fondo oscuro) cierra.
    dlg.addEventListener('click', e => { if (e.target === dlg) cerrarDialogo(dlg); });
  }
}
function cerrarDialogo(dlg){
  if (!dlg.open) return;
  dlg.classList.add('closing');
  setTimeout(() => { dlg.classList.remove('closing'); dlg.close(); }, 160);
}

/* ---------- 4. Mapa: solo con consentimiento ---------- */
function cargarMapa(box){
  if (box.querySelector('iframe')) return;
  box.innerHTML = '';
  const f = document.createElement('iframe');
  f.title = 'Mapa: ubicación de Hostal Dorado';
  f.loading = 'lazy';
  f.referrerPolicy = 'no-referrer-when-downgrade';
  f.src = DATOS_SITIO.mapsEmbed;
  box.appendChild(f);
}
function pintarAvisoMapa(box){
  box.innerHTML = `
    <div class="map-consent">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
      <p><b>El mapa está desactivado</b>Lo proporciona Google, que al cargarlo recibe tu IP y puede usar cookies.</p>
      <div class="map-consent-actions">
        <button type="button" class="btn btn-ok" data-mapa-si>Mostrar mapa</button>
        <a class="btn" href="${DATOS_SITIO.mapsLink}" target="_blank" rel="noopener">Abrir en Google Maps ↗</a>
      </div>
    </div>`;
  box.querySelector('[data-mapa-si]').onclick = () => {
    consent.guardar({ mapas: true, analitica: estadoActual ? estadoActual.analitica : false });
    cerrarBanner();
  };
}
function quitarMapas(){ $$('[data-mapa]').forEach(pintarAvisoMapa); }

$$('[data-mapa]').forEach(box => (estadoActual && estadoActual.mapas) ? cargarMapa(box) : pintarAvisoMapa(box));
if (estadoActual) aplicarConsentimiento(estadoActual);
else mostrarBanner();

/* ---------- 5. Datos del hostal en páginas legales ---------- */
if ($('[data-hostal]')) {
  fetch('/api/public/hostal')
    .then(r => r.ok ? r.json() : Promise.reject())
    .then(h => {
      $$('[data-hostal]').forEach(el => {
        const v = (h[el.dataset.hostal] || '').trim();
        if (v) el.textContent = v;
        else if (el.dataset.ocultarVacio !== undefined) el.closest('[data-fila]')?.remove();
      });
    })
    .catch(() => {});
}
