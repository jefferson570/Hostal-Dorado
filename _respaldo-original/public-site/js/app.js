/**
 * public-site/js/app.js
 * ---------------------------------------------------------------
 * Frontend público (cara al cliente). NO maneja sesión ni token:
 * solo consulta la disponibilidad y registra pre-reservas, todo a
 * través de /api/public. Toda la validación importante ocurre en el
 * servidor; aquí solo hay UX básica.
 */

/* EDITAR AQUÍ: datos de contacto y redes del hostal. */
const DATOS_SITIO = {
  direccion: 'Calle San Francisco 123, Cercado, Arequipa',
  telefono: '54 999 888 777',
  whatsapp: '51 999 888 777',          // con código de país, sin espacios ni +
  horarios: 'Lun a Dom · 7:00 a 22:00',
  mapaUrl: 'https://maps.google.com/maps?q=Plaza%20de%20Armas%20Arequipa&output=embed',
};

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
function escapeHTML(s){ return String(s ?? '').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

/* ---------- Datos de contacto (config arriba) ---------- */
$('#c-direccion').textContent = DATOS_SITIO.direccion;
$('#c-telefono').textContent = DATOS_SITIO.telefono;
$('#c-horarios').textContent = DATOS_SITIO.horarios;
$('#c-mapa').src = DATOS_SITIO.mapaUrl;
$('#c-tel').href = 'tel:' + DATOS_SITIO.telefono.replace(/[^\d+]/g, '');
const msgBase = 'Hola Hostal Dorado 👋, me gustaría información sobre una habitación.';
$('#c-whap').href = waLink(msgBase);
$('#wa-float').href = waLink(msgBase);

/* ---------- Tarifario: "Nuestras habitaciones" ---------- */
const DESCRIPCIONES = {
  Individual:   'Espaciosa y silenciosa, ideal para viajeros solos.',
  Matrimonial:  'Cama doble y baño privado, perfecta para parejas.',
  Doble:        'Dos camas separadas (o unidas a pedido), con baño propio.',
  Suite:        'La más amplia: sala de estar, TV y cama king.',
};
fetch('/api/public/tarifario')
  .then(r => r.json())
  .then(({ habitaciones }) => {
    $('#room-cards').innerHTML = (habitaciones || []).map(h => `
      <div class="room-card-st">
        <div class="room-photo">
          <span class="rp-mark">HD</span>
          <span class="rp-initial">${escapeHTML(h.tipo.charAt(0))}</span>
        </div>
        <div class="room-body">
          <h3>${escapeHTML(h.tipo)}</h3>
          <p>${escapeHTML(DESCRIPCIONES[h.tipo] || 'Habitación cómoda con baño privado.')}</p>
          <p class="room-precio">${money(h.precio)} <b>/ 12 h</b></p>
        </div>
      </div>`).join('') || '';
  })
  .catch(() => { /* el tarifario es decorativo; si falla se omite */ });

/* ---------- Fecha y hora por defecto: hoy a la hora corriente ---------- */
const fIn = $('#f-in'), fHora = $('#f-hora');
fHora.innerHTML = Array.from({ length: 24 }, (_, h) =>
  `<option value="${h}"${h === new Date().getHours() ? ' selected' : ''}>${String(h).padStart(2, '0')}:00</option>`
).join('');
fIn.value = todayISO();
fIn.min = todayISO();
fIn.addEventListener('change', () => { if (fIn.value < todayISO()) fIn.value = todayISO(); });

/* ---------- Toast ---------- */
let toastTimer;
function toast(msg, isError = false){
  const t = $('#toast');
  t.textContent = msg;
  t.className = isError ? 'show toast-error' : 'show';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.className = '', 2600);
}

/* ---------- Consultar disponibilidad ---------- */
async function buscar(){
  if (!fIn.value){
    toast('Elige la fecha de ingreso.', true);
    return;
  }
  const btn = $('#btn-buscar');
  btn.disabled = true; btn.textContent = 'Consultando…';
  try{
    const res = await fetch(`/api/public/rooms-availability?fecha=${fIn.value}&hora=${fHora.value}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'No se pudo consultar la disponibilidad.');

    $('#results-fechas').textContent = `El ${data.fecha} a las ${String(data.hora).padStart(2, '0')}:00 · bloque de 12 h`;
    const oferta = (data.habitaciones || []).filter(h => Number(h.total) > 0);
    $('#result-cards').innerHTML = oferta.map(h => {
      const queda = Number(h.disponibles) > 0;
      return `
      <div class="result-card${queda ? '' : ' rc-agotada'}">
        <div>
          <div class="rc-tipo">${escapeHTML(h.tipo)}</div>
          <div class="rc-precio">${money(h.precio)} <b>/ 12 h</b></div>
          <div class="rc-restan"><span class="rc-libre">${queda ? `${h.disponibles} ${h.disponibles === 1 ? 'disponible' : 'disponibles'}` : 'Ocupada'}</span>${queda ? ` de ${h.total}` : ' en ese horario'}</div>
        </div>
        <div class="rc-actions">
          ${queda ? `<button class="btn-reservar" data-tipo="${escapeHTML(h.tipo)}" data-precio="${h.precio}">Reservar</button>` : '<span class="rc-ocupada-lbl">No disponible</span>'}
        </div>
      </div>
    `;
    }).join('') || '';
    $('#results-empty').hidden = oferta.some(h => Number(h.disponibles) > 0);
    $('#results-empty').textContent = 'No hay habitaciones disponibles para esa fecha y hora. Prueba con otra hora.';
    $('#results').hidden = false;

    $$('.btn-reservar').forEach(b => b.addEventListener('click', () => abrirModal(b.dataset.tipo, Number(b.dataset.precio))));
  }catch(err){
    toast(err.message, true);
  }finally{
    btn.disabled = false; btn.textContent = 'Ver disponibilidad';
  }
}
$('#btn-buscar').addEventListener('click', buscar);

/* ---------- Modal de pre-reserva ---------- */
let seleccion = null;

function abrirModal(tipo, precio){
  seleccion = { tipo, precio, fecha: fIn.value, hora: Number(fHora.value) };
  $('#modal-box').innerHTML = `
    <h3>Pre-reserva — ${escapeHTML(tipo)}</h3>
    <p class="modal-sub">${money(precio)} por 12 h · el ${seleccion.fecha} a las ${String(seleccion.hora).padStart(2, '0')}:00 · <b>Total ${money(precio)}</b></p>
    <div class="field">
      <label>Nombre completo</label>
      <input id="pr-nombre" type="text" placeholder="Cómo te llamas" autocomplete="name">
    </div>
    <div class="field">
      <label>Teléfono (opcional)</label>
      <input id="pr-telefono" type="tel" placeholder="Ej. 999 999 999" autocomplete="tel">
    </div>
    <div class="field">
      <label>Correo (opcional)</label>
      <input id="pr-email" type="email" placeholder="tucorreo@ejemplo.com" autocomplete="email">
    </div>
    <p class="field-error" id="pr-error"></p>
    <p class="modal-note">Tu pre-reserva queda en espera: el hostal la confirma (12 horas desde tu hora de ingreso) y luego te contacta. No hay cargos por ahora.</p>
    <div class="modal-actions">
      <button class="btn" id="pr-cerrar">Cancelar</button>
      <button class="btn btn-ok" id="pr-enviar">Solicitar pre-reserva</button>
    </div>`;
  $('#modal-backdrop').classList.add('open');
  $('#pr-cerrar').onclick = cerrarModal;
  $('#pr-enviar').onclick = enviarPreReserva;
}

function cerrarModal(){ $('#modal-backdrop').classList.remove('open'); $('#modal-box').innerHTML = ''; }
$('#modal-backdrop').addEventListener('click', e => { if (e.target.id === 'modal-backdrop') cerrarModal(); });

async function enviarPreReserva(){
  const errBox = $('#pr-error');
  errBox.classList.remove('show');
  $('#pr-enviar').disabled = true;
  try{
    const res = await fetch('/api/public/reservations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tipo_habitacion: seleccion.tipo,
        checkin: seleccion.fecha,
        hora_ingreso: seleccion.hora,
        nombre: $('#pr-nombre').value.trim(),
        telefono: $('#pr-telefono').value.trim(),
        email: $('#pr-email').value.trim(),
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok){
      const campos = (data.detalles || []).map(d => d.mensaje).join('<br>');
      throw new Error(campos || data.error || 'No se pudo registrar la pre-reserva.');
    }
    const msgWa = `Hola, hice una pre-reserva (ref ${data.codigo}): habitación ${seleccion.tipo}, ingreso el ${seleccion.fecha} a las ${String(seleccion.hora).padStart(2, '0')}:00 (12 h). ¿Podrían confirmarla?`;
    $('#modal-box').innerHTML = `
      <div class="success">
        <div class="ok">✓</div>
        <h3>¡Solicitud recibida!</h3>
        <p>Tu <b>código de referencia</b> es: <span class="codigo">${escapeHTML(data.codigo)}</span><br>
        Quedó como pre-reserva en espera por 12 h desde las ${String(seleccion.hora).padStart(2, '0')}:00. Escríbenos por WhatsApp para confirmar tu llegada.</p>
        <div class="modal-actions" style="justify-content:center;">
          <a class="btn btn-ok" href="${waLink(msgWa)}" target="_blank" rel="noopener">Confirmar por WhatsApp</a>
          <button class="btn" id="pr-listook">Entendido</button>
        </div>
      </div>`;
    $('#pr-listook').onclick = cerrarModal;
    buscar(); // actualiza la disponibilidad mostrada (ese tipo baja de "disponibles")
  }catch(err){
    errBox.innerHTML = err.message.replace(/\n/g, '<br>');
    errBox.classList.add('show');
  }finally{
    $('#pr-enviar').disabled = false;
  }
}

$(window).addEventListener('keydown', e => { if (e.key === 'Escape') cerrarModal(); });