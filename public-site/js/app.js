/**
 * public-site/js/app.js
 * ---------------------------------------------------------------
 * Página principal del sitio público. NO maneja sesión ni token:
 * solo consulta disponibilidad y registra pre-reservas a través de
 * /api/public. Toda la validación importante ocurre en el servidor.
 * Usa lo definido en comun.js ($, $$, waLink, toast, abrirDialogo…).
 */

/* EDITAR AQUÍ: foto, descripción y detalles de cada tipo de habitación.
   La clave es el "tipo" tal como está en el panel (sin tildes ni mayúsculas).
   Si la foto no existe todavía, se muestra la ilustración de respaldo. */
const FOTOS = '/sitio/img/fotos/';
const HABITACIONES = {
  'estandar':        { foto: 'estandar.jpg',      ilus: 'estandar',      desc: 'Cama de dos plazas, baño privado con agua caliente y TV. Ideal para descansar después de recorrer la ciudad.', feats: ['2 plazas', 'Baño privado', 'TV cable'] },
  'estandar plus':   { foto: 'estandar-plus.jpg', ilus: 'estandar-plus', desc: 'Más espacio y un sofá: perfecta para estadías largas o viajes de trabajo.', feats: ['Más amplia', 'Sofá', 'Baño privado'] },
  'ducha electrica': { foto: 'ducha.jpg',         ilus: 'ducha',         desc: 'Cómoda y económica, con ducha eléctrica de agua caliente al instante.', feats: ['Económica', 'Ducha eléctrica', 'Baño privado'] },
  'suite':           { foto: 'suite.jpg',         ilus: 'suite',         desc: 'Nuestra habitación más completa: cama de dos plazas, sofá y sillón de descanso.', feats: ['2 plazas', 'Sofá', 'Premium'] },
  'familiar':        { foto: 'familiar.jpg',      ilus: 'familiar',      desc: 'Dos camas para compartir en familia o con amigos, con todo el confort del hostal.', feats: ['2 camas', 'Hasta 4 personas', 'Baño privado'] },
  'departamento':    { foto: 'departamento.jpg',  ilus: 'departamento',  desc: 'Cocina equipada y ambiente independiente: como en casa, en plena Arequipa.', feats: ['Cocina equipada', 'Independiente', 'Estadías largas'] },
};

/* EDITAR AQUÍ: fotos de la galería «Así es el hostal». Las que no existan se omiten solas. */
const GALERIA = [
  { src: 'lobby.jpg',         alt: 'Sala de recepción con sofás y ventanales a la calle' },
  { src: 'suite.jpg',         alt: 'Suite con cama de dos plazas, sofá y sillón de descanso' },
  { src: 'estandar-plus.jpg', alt: 'Habitación amplia con sofá y cortinas' },
  { src: 'estandar.jpg',      alt: 'Habitación con cama de dos plazas, televisor y escritorio' },
  { src: 'departamento.jpg',  alt: 'Cocina equipada del departamento' },
  { src: 'ducha.jpg',         alt: 'Habitación con repisas, televisor y baño propio' },
  { src: 'pasillo.jpg',       alt: 'Pasillo con extintor y señalización de salida' },
];

const normaliza = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const infoTipo = tipo => HABITACIONES[normaliza(tipo)] || { foto: '', ilus: 'estandar', desc: 'Habitación cómoda con baño privado y agua caliente.', feats: ['Baño privado', 'Wi-Fi'] };
const ilusTipo = tipo => `/sitio/img/rooms/${infoTipo(tipo).ilus}.svg`;
const fotoTipo = tipo => infoTipo(tipo).foto ? FOTOS + infoTipo(tipo).foto : ilusTipo(tipo);

/* Si la foto real no carga, cae a la ilustración (sin handlers inline: la CSP los bloquea). */
function conRespaldo(root){
  root.querySelectorAll('img[data-respaldo]').forEach(img => {
    const fallar = () => { if (img.src.indexOf(img.dataset.respaldo) === -1) { img.src = img.dataset.respaldo; img.classList.add('is-ilus'); } };
    if (img.complete && img.naturalWidth === 0) fallar();
    else img.addEventListener('error', fallar, { once: true });
  });
}

const money = n => 'S/ ' + Number(n || 0).toFixed(Number(n) % 1 ? 2 : 0);
const hh = h => String(h).padStart(2, '0') + ':00';
const isoLocal = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const todayISO = () => isoLocal(new Date());
function escapeHTML(s){ return String(s ?? '').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function fechaLarga(iso){
  return new Date(iso + 'T12:00:00').toLocaleDateString('es-PE', { weekday:'long', day:'numeric', month:'long' });
}
function horaFin(h){ return hh((Number(h) + 12) % 24); }

/* ---------- Fecha y hora por defecto: hoy a la próxima hora ---------- */
const fIn = $('#f-in'), fHora = $('#f-hora');
const horaSugerida = Math.min(23, new Date().getHours() + 1);
fHora.innerHTML = Array.from({ length: 24 }, (_, h) =>
  `<option value="${h}"${h === horaSugerida ? ' selected' : ''}>${hh(h)}</option>`
).join('');
fIn.value = todayISO();
fIn.min = todayISO();
fIn.max = isoLocal(new Date(Date.now() + 365 * 86400000));
fIn.addEventListener('change', () => { if (fIn.value && fIn.value < todayISO()) fIn.value = todayISO(); });

/* ---------- Nuestras habitaciones ---------- */
fetch('/api/public/tarifario')
  .then(r => r.ok ? r.json() : Promise.reject())
  .then(({ habitaciones }) => {
    const lista = (habitaciones || []).slice().sort((a, b) => a.precio - b.precio);
    const box = $('#room-cards');
    box.innerHTML = lista.map(h => {
      const info = infoTipo(h.tipo);
      return `
      <article class="room-card-st">
        <div class="room-photo">
          <img src="${fotoTipo(h.tipo)}" data-respaldo="${ilusTipo(h.tipo)}" alt="Habitación ${escapeHTML(h.tipo)}" loading="lazy" width="800" height="520">
        </div>
        <div class="room-body">
          <h3>${escapeHTML(h.tipo)}</h3>
          <p>${escapeHTML(info.desc)}</p>
          <ul class="room-feats">${info.feats.map(f => `<li>${escapeHTML(f)}</li>`).join('')}</ul>
          <div class="room-foot">
            <div class="room-precio"><b>${money(h.precio)}</b><span>por 12 horas</span></div>
            <button type="button" class="btn-reservar" data-tipo="${escapeHTML(h.tipo)}" data-precio="${Number(h.precio)}">Reservar<span class="visually-hidden"> ${escapeHTML(h.tipo)}</span></button>
          </div>
        </div>
      </article>`;
    }).join('') || '<p class="empty-note">Pronto publicaremos nuestras habitaciones.</p>';
    box.setAttribute('aria-busy', 'false');
    conRespaldo(box);
    $$('#room-cards .btn-reservar').forEach(b => b.addEventListener('click', () => abrirModal(b.dataset.tipo, Number(b.dataset.precio))));
  })
  .catch(() => {
    $('#room-cards').setAttribute('aria-busy', 'false');
    $('#room-cards').innerHTML = '<p class="empty-note">No pudimos cargar las habitaciones. Escríbenos por WhatsApp y te ayudamos.</p>';
  });

/* ---------- Galería (solo muestra las fotos que existen) ---------- */
(function galeria(){
  const box = $('#gallery');
  if (!box) return;
  let cargadas = 0;
  GALERIA.forEach((g, i) => {
    const fig = document.createElement('figure');
    fig.className = 'gallery-item' + (i === 0 ? ' is-wide' : '');
    const img = new Image();
    img.alt = g.alt;
    // Sin loading="lazy": la imagen aún no está en la página, y en modo
    // diferido el navegador nunca la descargaría.
    img.decoding = 'async';
    img.onload = () => { cargadas++; box.appendChild(fig); $('#galeria').hidden = false; ordenar(); };
    img.onerror = () => {};
    img.src = FOTOS + g.src;
    fig.dataset.orden = i;
    fig.appendChild(img);
  });
  function ordenar(){
    Array.from(box.children).sort((a, b) => a.dataset.orden - b.dataset.orden).forEach(n => box.appendChild(n));
    box.dataset.cantidad = String(cargadas);
  }
})();

/* ---------- Consultar disponibilidad ---------- */
async function buscar({ scroll = true } = {}){
  if (!fIn.value){ toast('Elige el día de llegada.', true); fIn.focus(); return; }
  const btn = $('#btn-buscar');
  const label = btn.querySelector('span');
  btn.disabled = true; label.textContent = 'Buscando…';
  try{
    const res = await fetch(`/api/public/rooms-availability?fecha=${encodeURIComponent(fIn.value)}&hora=${encodeURIComponent(fHora.value)}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'No se pudo consultar la disponibilidad.');

    $('#results-fechas').textContent = `${fechaLarga(data.fecha)} · de ${hh(data.hora)} a ${horaFin(data.hora)}`;
    const oferta = (data.habitaciones || []).filter(h => Number(h.total) > 0)
      .sort((a, b) => (Number(b.disponibles) > 0) - (Number(a.disponibles) > 0) || a.precio - b.precio);
    $('#result-cards').innerHTML = oferta.map((h, i) => {
      const queda = Number(h.disponibles) > 0;
      return `
      <div class="result-card${queda ? '' : ' rc-agotada'}" style="--i:${i}">
        <img src="${fotoTipo(h.tipo)}" data-respaldo="${ilusTipo(h.tipo)}" alt="" width="128" height="108">
        <div class="rc-body">
          <div>
            <h3 class="rc-tipo">${escapeHTML(h.tipo)}</h3>
            <p class="rc-restan">${queda
              ? `<span class="rc-libre">${h.disponibles} ${Number(h.disponibles) === 1 ? 'libre' : 'libres'}</span>`
              : '<span class="rc-libre">Sin cupo en ese horario</span>'}</p>
          </div>
          <div class="rc-foot">
            <div class="rc-precio"><b>${money(h.precio)}</b> por 12 h</div>
            ${queda ? `<button type="button" class="btn-reservar" data-tipo="${escapeHTML(h.tipo)}" data-precio="${Number(h.precio)}">Reservar<span class="visually-hidden"> ${escapeHTML(h.tipo)}</span></button>` : ''}
          </div>
        </div>
      </div>`;
    }).join('');
    conRespaldo($('#result-cards'));
    const hayAlguna = oferta.some(h => Number(h.disponibles) > 0);
    $('#results-empty').hidden = hayAlguna;
    $('#results-empty').innerHTML = `No quedan habitaciones para ese día y hora. Prueba otra hora o <a href="${waLink('Hola, busco habitación para el ' + fIn.value + ' a las ' + hh(fHora.value) + '.')}" target="_blank" rel="noopener">escríbenos por WhatsApp</a>: siempre buscamos una opción.`;
    $('#results').hidden = false;
    $$('#result-cards .btn-reservar').forEach(b => b.addEventListener('click', () => abrirModal(b.dataset.tipo, Number(b.dataset.precio))));
    if (scroll){
      $('#results').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
      $('#results').focus({ preventScroll: true });
    }
  }catch(err){
    toast(err.message, true);
  }finally{
    btn.disabled = false; label.textContent = 'Ver habitaciones libres';
  }
}
$('#search-form').addEventListener('submit', e => { e.preventDefault(); buscar(); });

/* ---------- Pre-reserva ---------- */
const dlg = $('#modal-reserva');
let seleccion = null;
const iconoCerrar = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';

function abrirModal(tipo, precio){
  if (!fIn.value) fIn.value = todayISO();
  seleccion = { tipo, precio, fecha: fIn.value, hora: Number(fHora.value) };
  dlg.innerHTML = `
    <button type="button" class="modal-close" data-cerrar aria-label="Cerrar">${iconoCerrar}</button>
    <div class="modal-hero">
      <img src="${fotoTipo(tipo)}" data-respaldo="${ilusTipo(tipo)}" alt="">
      <h2 id="modal-titulo">${escapeHTML(tipo)}</h2>
    </div>
    <div class="modal-body">
      <dl class="resumen-reserva">
        <div><dt>Llegada</dt><dd>${escapeHTML(fechaLarga(seleccion.fecha).replace(/^\w+,\s*/, ''))}</dd></div>
        <div><dt>Horario</dt><dd>${hh(seleccion.hora)} a ${horaFin(seleccion.hora)}</dd></div>
        <div><dt>Precio</dt><dd>${money(precio)}</dd></div>
      </dl>
      <form id="pr-form" novalidate>
        <div class="field">
          <label for="pr-nombre">Nombre completo</label>
          <input id="pr-nombre" type="text" placeholder="Como figura en tu documento" autocomplete="name" maxlength="80" required aria-describedby="pr-error">
        </div>
        <div class="field-row">
          <div class="field">
            <label for="pr-telefono">Celular o WhatsApp</label>
            <input id="pr-telefono" type="tel" placeholder="999 999 999" autocomplete="tel" maxlength="20" inputmode="tel" aria-describedby="pr-contacto-ayuda">
          </div>
          <div class="field">
            <label for="pr-email">Correo <span class="opt">(opcional)</span></label>
            <input id="pr-email" type="email" placeholder="tucorreo@ejemplo.com" autocomplete="email" maxlength="120" aria-describedby="pr-contacto-ayuda">
          </div>
        </div>
        <p class="field-hint" id="pr-contacto-ayuda">Basta con uno de los dos para poder confirmarte.</p>
        <label class="check">
          <input type="checkbox" id="pr-acepto" required>
          <span>Acepto que Hostal Dorado use estos datos solo para gestionar mi reserva, según la <a href="/privacidad" target="_blank" rel="noopener">Política de privacidad</a> y los <a href="/terminos" target="_blank" rel="noopener">Términos</a>.</span>
        </label>
        <p class="field-error" id="pr-error" role="alert"></p>
        <p class="modal-note">Es una <b>pre-reserva sin costo</b>. Recepción la confirma por WhatsApp o correo y pagas al llegar. Tus datos se eliminan 90 días después de tu estadía.</p>
        <div class="modal-actions">
          <button type="button" class="btn" data-cerrar>Cancelar</button>
          <button type="submit" class="btn btn-ok" id="pr-enviar">Enviar solicitud</button>
        </div>
      </form>
    </div>`;
  conRespaldo(dlg);
  $$('#modal-reserva [data-cerrar]').forEach(b => b.onclick = () => cerrarDialogo(dlg));
  $('#pr-form').addEventListener('submit', e => { e.preventDefault(); enviarPreReserva(); });
  abrirDialogo(dlg);
  $('#pr-nombre').focus();
}

function mostrarError(msg, campo){
  const errBox = $('#pr-error');
  errBox.classList.remove('show');
  void errBox.offsetWidth; // reinicia la animación
  errBox.textContent = msg;
  errBox.classList.add('show');
  $$('#pr-form [aria-invalid]').forEach(el => el.removeAttribute('aria-invalid'));
  if (campo){ campo.setAttribute('aria-invalid', 'true'); campo.focus(); }
}

let enviando = false;
async function enviarPreReserva(){
  if (enviando) return; // evita doble envío por doble clic
  const nombre = $('#pr-nombre').value.trim();
  const telefono = $('#pr-telefono').value.trim();
  const email = $('#pr-email').value.trim();
  if (nombre.length < 3) return mostrarError('Escribe tu nombre completo.', $('#pr-nombre'));
  if (!telefono && !email) return mostrarError('Déjanos un celular o un correo para poder confirmarte.', $('#pr-telefono'));
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return mostrarError('Revisa tu correo: parece incompleto.', $('#pr-email'));
  if (!$('#pr-acepto').checked) return mostrarError('Para enviar tu solicitud, marca la casilla de privacidad.', $('#pr-acepto'));

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
        acepta_privacidad: true,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok){
      const detalle = (data.detalles || []).map(d => d.mensaje)[0];
      throw new Error(detalle || data.error || 'No se pudo registrar la pre-reserva.');
    }
    const msgWa = `Hola, hice una pre-reserva en Hostal Dorado (código ${data.codigo}): ${seleccion.tipo}, llegada el ${seleccion.fecha} a las ${hh(seleccion.hora)}. ¿Me la confirman?`;
    dlg.innerHTML = `
      <button type="button" class="modal-close on-light" data-cerrar aria-label="Cerrar">${iconoCerrar}</button>
      <div class="success">
        <div class="ok"><svg viewBox="0 0 24 24" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg></div>
        <h2 id="modal-titulo">¡Solicitud recibida!</h2>
        <p>Tu código de reserva es:</p>
        <div class="codigo-box"><span class="codigo" id="pr-codigo"></span><button type="button" class="btn-copiar" id="pr-copiar">Copiar</button></div>
        <p>Separamos una habitación <b>${escapeHTML(seleccion.tipo)}</b> de ${hh(seleccion.hora)} a ${horaFin(seleccion.hora)}. Para confirmarla más rápido, envíanos el código por WhatsApp.</p>
        <div class="modal-actions">
          <a class="btn btn-wa" href="${waLink(msgWa)}" target="_blank" rel="noopener">Confirmar por WhatsApp</a>
          <button type="button" class="btn" data-cerrar>Listo</button>
        </div>
      </div>`;
    $('#pr-codigo').textContent = data.codigo;
    $$('#modal-reserva [data-cerrar]').forEach(b => b.onclick = () => cerrarDialogo(dlg));
    $('#pr-copiar').onclick = async () => {
      try { await navigator.clipboard.writeText(data.codigo); $('#pr-copiar').textContent = '¡Copiado!'; }
      catch (_) { toast('Anota tu código: ' + data.codigo); }
    };
    $('#modal-reserva .btn-wa').focus();
    if (!$('#results').hidden) buscar({ scroll: false }); // actualiza la disponibilidad mostrada
  }catch(err){
    if ($('#pr-error')) mostrarError(err.message);
    else toast(err.message, true);
  }finally{
    enviando = false;
    const b = $('#pr-enviar');
    if (b){ b.disabled = false; b.textContent = 'Enviar solicitud'; }
  }
}
