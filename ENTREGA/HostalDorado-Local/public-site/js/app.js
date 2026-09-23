/**
 * public-site/js/app.js
 * ---------------------------------------------------------------
 * Frontend público (cara al cliente). NO maneja sesión ni token:
 * solo consulta la disponibilidad y registra pre-reservas, todo a
 * través de /api/public. Toda la validación importante ocurre en el
 * servidor; aquí solo hay UX.
 */

/* EDITAR AQUÍ: datos de contacto y redes del hostal. */
const DATOS_SITIO = {
  direccion: 'Calle San Francisco 123, Cercado, Arequipa',
  telefono: '54 999 888 777',
  whatsapp: '51 999 888 777',          // con código de país, sin espacios ni +
  horarios: 'Lun a Dom · 7:00 a 22:00',
  mapaUrl: 'https://maps.google.com/maps?q=Plaza%20de%20Armas%20Arequipa&output=embed',
};

/* EDITAR AQUÍ: descripción, ilustración y detalles de cada tipo de habitación.
   La clave es el "tipo" tal como está en el panel (sin tildes ni mayúsculas). */
const HABITACIONES = {
  'estandar':        { img: 'estandar',      desc: 'Cama de dos plazas, baño privado con agua caliente y TV. Ideal para descansar después de recorrer la ciudad.', feats: ['2 plazas', 'Baño privado', 'TV cable'] },
  'estandar plus':   { img: 'estandar-plus', desc: 'Más espacio y un sillón de lectura: perfecta para estadías largas o viajes de trabajo.', feats: ['Más amplia', 'Sillón', 'Escritorio'] },
  'ducha electrica': { img: 'ducha',         desc: 'Cómoda y económica, con ducha eléctrica de agua caliente al instante.', feats: ['Económica', 'Ducha eléctrica', 'Baño privado'] },
  'suite':           { img: 'suite',         desc: 'Nuestra habitación más amplia: cama grande, zona de estar y detalles de categoría.', feats: ['Cama queen', 'Zona de estar', 'Premium'] },
  'familiar':        { img: 'familiar',      desc: 'Dos camas para compartir en familia o con amigos, con todo el confort del hostal.', feats: ['2 camas', 'Hasta 4 personas', 'Baño privado'] },
  'departamento':    { img: 'departamento',  desc: 'Kitchenette equipada y ambiente independiente: como en casa, en plena Arequipa.', feats: ['Kitchenette', 'Independiente', 'Estadías largas'] },
};
const normaliza = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const infoTipo = tipo => HABITACIONES[normaliza(tipo)] || { img: 'estandar', desc: 'Habitación cómoda con baño privado y agua caliente.', feats: ['Baño privado', 'Wi-Fi'] };
const imgTipo = tipo => `/sitio/img/rooms/${infoTipo(tipo).img}.svg`;

const waNum = DATOS_SITIO.whatsapp.replace(/[^\d]/g, '');
const waLink = msg => `https://wa.me/${waNum}${msg ? '?text=' + encodeURIComponent(msg) : ''}`;

const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));

const todayISO = () => {
  const d = new Date();
  const f = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${f(d.getMonth()+1)}-${f(d.getDate())}`;
};
const money = n => 'S/ ' + Number(n || 0).toFixed(2);
const hh = h => String(h).padStart(2, '0') + ':00';
function escapeHTML(s){ return String(s ?? '').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function fechaLarga(iso){
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString('es-PE', { weekday:'long', day:'numeric', month:'long' });
}

/* ---------- Datos de contacto (config arriba) ---------- */
$('#c-direccion').textContent = DATOS_SITIO.direccion;
$('#c-telefono').textContent = DATOS_SITIO.telefono;
$('#c-horarios').textContent = DATOS_SITIO.horarios;
$('#c-mapa').src = DATOS_SITIO.mapaUrl;
$('#c-tel').href = 'tel:' + DATOS_SITIO.telefono.replace(/[^\d+]/g, '');
const msgBase = 'Hola Hostal Dorado, me gustaría información sobre una habitación.';
$('#c-whap').href = waLink(msgBase);
$('#wa-float').href = waLink(msgBase);
$('#year').textContent = new Date().getFullYear();

/* ---------- Cabecera: sólida al hacer scroll + menú móvil ---------- */
const header = $('#site-header');
const onScroll = () => header.classList.toggle('scrolled', window.scrollY > 40);
window.addEventListener('scroll', onScroll, { passive: true });
onScroll();
$('#nav-toggle').addEventListener('click', () => {
  const abierto = $('#site-nav').classList.toggle('open');
  $('#nav-toggle').setAttribute('aria-expanded', String(abierto));
});
$$('#site-nav a').forEach(a => a.addEventListener('click', () => {
  $('#site-nav').classList.remove('open');
  $('#nav-toggle').setAttribute('aria-expanded', 'false');
}));

/* ---------- Animaciones al hacer scroll ---------- */
const observer = 'IntersectionObserver' in window
  ? new IntersectionObserver(entries => entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('visible'); observer.unobserve(e.target); }
    }), { threshold: 0.12, rootMargin: '0px 0px -40px 0px' })
  : null;
function observar(root = document){
  root.querySelectorAll('.reveal:not(.visible)').forEach(el => observer ? observer.observe(el) : el.classList.add('visible'));
}
observar();

/* ---------- Toast ---------- */
function toast(msg, isError = false){
  const box = $('#toast');
  const el = document.createElement('div');
  el.className = 'toast' + (isError ? ' error' : '');
  el.textContent = msg;
  box.appendChild(el);
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 300); }, isError ? 4500 : 2800);
}

/* ---------- Fecha y hora por defecto: hoy a la próxima hora ---------- */
const fIn = $('#f-in'), fHora = $('#f-hora');
const horaSugerida = Math.min(23, new Date().getHours() + 1);
fHora.innerHTML = Array.from({ length: 24 }, (_, h) =>
  `<option value="${h}"${h === horaSugerida ? ' selected' : ''}>${hh(h)}</option>`
).join('');
fIn.value = todayISO();
fIn.min = todayISO();
const maxFecha = new Date(Date.now() + 365 * 86400000);
fIn.max = `${maxFecha.getFullYear()}-${String(maxFecha.getMonth()+1).padStart(2,'0')}-${String(maxFecha.getDate()).padStart(2,'0')}`;
fIn.addEventListener('change', () => { if (fIn.value && fIn.value < todayISO()) fIn.value = todayISO(); });

/* ---------- Tarifario: "Nuestras habitaciones" ---------- */
let tarifario = [];
fetch('/api/public/tarifario')
  .then(r => r.ok ? r.json() : Promise.reject())
  .then(({ habitaciones }) => {
    tarifario = (habitaciones || []).slice().sort((a, b) => a.precio - b.precio);
    $('#room-cards').innerHTML = tarifario.map((h, i) => {
      const info = infoTipo(h.tipo);
      return `
      <article class="room-card-st reveal" style="transition-delay:${(i % 3) * 0.08}s">
        <div class="room-photo">
          <span class="room-badge">${h.total} ${h.total === 1 ? 'HABITACIÓN' : 'HABITACIONES'}</span>
          <img src="${imgTipo(h.tipo)}" alt="Ilustración de la habitación ${escapeHTML(h.tipo)}" loading="lazy">
        </div>
        <div class="room-body">
          <h3>${escapeHTML(h.tipo)}</h3>
          <p>${escapeHTML(info.desc)}</p>
          <ul class="room-feats">${info.feats.map(f => `<li>${escapeHTML(f)}</li>`).join('')}</ul>
          <div class="room-foot">
            <div class="room-precio">Desde<b>${money(h.precio)} <small>/ 12 h</small></b></div>
            <button class="btn-reservar" data-tipo="${escapeHTML(h.tipo)}" data-precio="${Number(h.precio)}">Reservar</button>
          </div>
        </div>
      </article>`;
    }).join('') || '<p class="empty-note">Pronto publicaremos nuestras habitaciones.</p>';
    observar($('#room-cards'));
    $$('#room-cards .btn-reservar').forEach(b => b.addEventListener('click', () => abrirModal(b.dataset.tipo, Number(b.dataset.precio))));
  })
  .catch(() => { $('#room-cards').innerHTML = '<p class="empty-note">No pudimos cargar las habitaciones. Escríbenos por WhatsApp y te ayudamos.</p>'; });

/* ---------- Consultar disponibilidad ---------- */
async function buscar({ scroll = true } = {}){
  if (!fIn.value){ toast('Elige la fecha de ingreso.', true); fIn.focus(); return; }
  const btn = $('#btn-buscar');
  const textoOriginal = btn.innerHTML;
  btn.disabled = true; btn.textContent = 'Consultando…';
  try{
    const res = await fetch(`/api/public/rooms-availability?fecha=${encodeURIComponent(fIn.value)}&hora=${encodeURIComponent(fHora.value)}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'No se pudo consultar la disponibilidad.');

    $('#results-fechas').textContent = `${fechaLarga(data.fecha)} · desde las ${hh(data.hora)} por 12 h`;
    const oferta = (data.habitaciones || []).filter(h => Number(h.total) > 0)
      .sort((a, b) => (Number(b.disponibles) > 0) - (Number(a.disponibles) > 0));
    $('#result-cards').innerHTML = oferta.map((h, i) => {
      const queda = Number(h.disponibles) > 0;
      return `
      <div class="result-card${queda ? '' : ' rc-agotada'}" style="animation-delay:${i * 0.06}s">
        <img src="${imgTipo(h.tipo)}" alt="">
        <div class="rc-body">
          <div>
            <div class="rc-tipo">${escapeHTML(h.tipo)}</div>
            <div class="rc-restan"><span class="rc-libre">${queda ? `${h.disponibles} ${Number(h.disponibles) === 1 ? 'disponible' : 'disponibles'}` : 'Sin disponibilidad'}</span>${queda ? ` de ${h.total}` : ' en ese horario'}</div>
          </div>
          <div class="rc-foot">
            <div class="rc-precio">Desde<b>${money(h.precio)}</b></div>
            ${queda ? `<button class="btn-reservar" data-tipo="${escapeHTML(h.tipo)}" data-precio="${Number(h.precio)}">Reservar</button>` : '<span class="rc-ocupada-lbl">Ocupada</span>'}
          </div>
        </div>
      </div>`;
    }).join('');
    const hayAlguna = oferta.some(h => Number(h.disponibles) > 0);
    $('#results-empty').hidden = hayAlguna;
    $('#results-empty').textContent = 'No quedan habitaciones para esa fecha y hora. Prueba con otra hora o escríbenos por WhatsApp: siempre buscamos una opción.';
    $('#results').hidden = false;
    $$('#result-cards .btn-reservar').forEach(b => b.addEventListener('click', () => abrirModal(b.dataset.tipo, Number(b.dataset.precio))));
    if (scroll) $('#results').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }catch(err){
    toast(err.message, true);
  }finally{
    btn.disabled = false; btn.innerHTML = textoOriginal;
  }
}
$('#search-form').addEventListener('submit', e => { e.preventDefault(); buscar(); });

/* ---------- Modal de pre-reserva ---------- */
let seleccion = null;
const iconoCerrar = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';

function abrirModal(tipo, precio){
  if (!fIn.value) fIn.value = todayISO();
  seleccion = { tipo, precio, fecha: fIn.value, hora: Number(fHora.value) };
  $('#modal-box').innerHTML = `
    <button class="modal-close" id="pr-x" aria-label="Cerrar">${iconoCerrar}</button>
    <div class="modal-hero">
      <img src="${imgTipo(tipo)}" alt="">
      <h3>${escapeHTML(tipo)}</h3>
    </div>
    <div class="modal-body">
      <div class="resumen-reserva">
        <div><small>Ingreso</small><b>${escapeHTML(fechaLarga(seleccion.fecha).replace(/^\w+,\s*/, ''))}</b></div>
        <div><small>Hora</small><b>${hh(seleccion.hora)}</b></div>
        <div><small>Desde</small><b>${money(precio)}</b></div>
      </div>
      <form id="pr-form" novalidate>
        <div class="field">
          <label for="pr-nombre">Nombre completo</label>
          <input id="pr-nombre" type="text" placeholder="Como figura en tu documento" autocomplete="name" maxlength="80" required>
        </div>
        <div class="field-row">
          <div class="field">
            <label for="pr-telefono">Celular / WhatsApp</label>
            <input id="pr-telefono" type="tel" placeholder="999 999 999" autocomplete="tel" maxlength="20" inputmode="tel">
          </div>
          <div class="field">
            <label for="pr-email">Correo (opcional)</label>
            <input id="pr-email" type="email" placeholder="tucorreo@ejemplo.com" autocomplete="email" maxlength="120">
          </div>
        </div>
        <p class="field-error" id="pr-error"></p>
        <p class="modal-note">Tu pre-reserva queda en espera hasta que el hostal la confirme (12 horas desde tu hora de ingreso). Te contactaremos por WhatsApp o correo. <b>No hay cargos por ahora.</b></p>
        <div class="modal-actions">
          <button type="button" class="btn" id="pr-cerrar">Cancelar</button>
          <button type="submit" class="btn btn-ok" id="pr-enviar">Solicitar pre-reserva</button>
        </div>
      </form>
    </div>`;
  $('#modal-backdrop').classList.add('open');
  document.body.style.overflow = 'hidden';
  $('#pr-x').onclick = cerrarModal;
  $('#pr-cerrar').onclick = cerrarModal;
  $('#pr-form').addEventListener('submit', e => { e.preventDefault(); enviarPreReserva(); });
  setTimeout(() => $('#pr-nombre')?.focus(), 80);
}

function cerrarModal(){
  $('#modal-backdrop').classList.remove('open');
  $('#modal-box').innerHTML = '';
  document.body.style.overflow = '';
}
$('#modal-backdrop').addEventListener('click', e => { if (e.target.id === 'modal-backdrop') cerrarModal(); });
window.addEventListener('keydown', e => { if (e.key === 'Escape' && $('#modal-backdrop').classList.contains('open')) cerrarModal(); });

function mostrarError(msg){
  const errBox = $('#pr-error');
  errBox.classList.remove('show');
  void errBox.offsetWidth; // reinicia la animación
  errBox.textContent = msg;
  errBox.classList.add('show');
}

let enviando = false;
async function enviarPreReserva(){
  if (enviando) return; // evita doble envío por doble clic
  const nombre = $('#pr-nombre').value.trim();
  const telefono = $('#pr-telefono').value.trim();
  const email = $('#pr-email').value.trim();
  if (nombre.length < 3){ mostrarError('Escribe tu nombre completo.'); $('#pr-nombre').focus(); return; }
  if (!telefono && !email){ mostrarError('Déjanos un celular o un correo para poder confirmarte.'); $('#pr-telefono').focus(); return; }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){ mostrarError('Revisa tu correo electrónico.'); $('#pr-email').focus(); return; }

  enviando = true;
  const btn = $('#pr-enviar');
  btn.disabled = true; btn.textContent = 'Enviando…';
  try{
    const res = await fetch('/api/public/reservations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tipo_habitacion: seleccion.tipo,
        checkin: seleccion.fecha,
        hora_ingreso: seleccion.hora,
        nombre, telefono, email,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok){
      const detalle = (data.detalles || []).map(d => d.mensaje)[0];
      throw new Error(detalle || data.error || 'No se pudo registrar la pre-reserva.');
    }
    const msgWa = `Hola, hice una pre-reserva en Hostal Dorado (código ${data.codigo}): habitación ${seleccion.tipo}, ingreso el ${seleccion.fecha} a las ${hh(seleccion.hora)} (12 h). ¿Podrían confirmarla?`;
    $('#modal-box').innerHTML = `
      <button class="modal-close" id="pr-x" aria-label="Cerrar" style="background:var(--cream-100);color:var(--ink-900)">${iconoCerrar}</button>
      <div class="success">
        <div class="ok"><svg viewBox="0 0 24 24" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg></div>
        <h3>¡Solicitud recibida!</h3>
        <p>Guarda tu código de referencia:</p>
        <div class="codigo-box"><span class="codigo" id="pr-codigo"></span><button class="btn-copiar" id="pr-copiar">Copiar</button></div>
        <p>Tu pre-reserva de <b>${escapeHTML(seleccion.tipo)}</b> quedó en espera desde las ${hh(seleccion.hora)}. Escríbenos por WhatsApp para confirmar tu llegada.</p>
        <div class="modal-actions">
          <a class="btn btn-wa" href="${waLink(msgWa)}" target="_blank" rel="noopener">Confirmar por WhatsApp</a>
          <button class="btn" id="pr-listook">Entendido</button>
        </div>
      </div>`;
    $('#pr-codigo').textContent = data.codigo;
    $('#pr-x').onclick = cerrarModal;
    $('#pr-listook').onclick = cerrarModal;
    $('#pr-copiar').onclick = async () => {
      try { await navigator.clipboard.writeText(data.codigo); $('#pr-copiar').textContent = '¡Copiado!'; }
      catch (_) { toast('Anota tu código: ' + data.codigo); }
    };
    if (!$('#results').hidden) buscar({ scroll: false }); // actualiza la disponibilidad mostrada
  }catch(err){
    if ($('#pr-error')) mostrarError(err.message);
    else toast(err.message, true);
  }finally{
    enviando = false;
    const b = $('#pr-enviar');
    if (b){ b.disabled = false; b.textContent = 'Solicitar pre-reserva'; }
  }
}
