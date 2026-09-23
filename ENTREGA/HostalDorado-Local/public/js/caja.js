/**
 * caja.js
 * ---------------------------------------------------------------
 * Todo lo relacionado con el dinero del hostal en el panel:
 *   - Componente de COBRO reutilizable: un método o pago mixto
 *     (p. ej. mitad Yape y mitad efectivo), vuelto y comprobante
 *     (ninguno / boleta / factura). Lo usan check-out y ventas.
 *   - Vista "Caja y comprobantes": caja del turno por método de pago,
 *     cierre de caja con ticket, historial de cierres y comprobantes.
 *   - Configuración (admin): datos del hostal y usuarios del sistema.
 * Usa las utilidades globales de app.js ($, api, money, icon, toast…).
 */
const METODOS = ['Efectivo', 'Yape', 'Plin', 'Tarjeta', 'Transferencia'];
const METODO_IC = { Efectivo: 'efectivo', Yape: 'celular', Plin: 'celular', Tarjeta: 'tarjeta', Transferencia: 'banco', Mixto: 'mixto' };
const METODO_CLASE = m => 'mp-' + String(m).toLowerCase().normalize('NFD').replace(/[^a-z]/g, '');
const r2 = n => Math.round(Number(n) * 100) / 100;

/** Pastillas "Efectivo S/ 60 · Yape S/ 60" para tablas y listas. */
function pagosHTML(pagos, conMonto) {
  const mostrarMonto = conMonto ?? pagos.length > 1;
  return `<span class="mp-list">${pagos.map(p =>
    `<span class="mp ${METODO_CLASE(p.metodo)}">${escapeHTML(p.metodo)}${mostrarMonto ? ` <b>${Number(p.monto).toFixed(2)}</b>` : ''}</span>`).join('')}</span>`;
}

function abrirImpresion(query){
  const w = window.open(`/imprimir.html?${query}&auto=1`, '_blank');
  if (!w) toast('Tu navegador bloqueó la ventana de impresión: permite ventanas emergentes para este sitio.', true);
}
const imprimirComprobante = id => abrirImpresion('c=' + encodeURIComponent(id));
const imprimirCierre = id => abrirImpresion('cierre=' + encodeURIComponent(id));

/* ============================================================
   COMPONENTE DE COBRO
   ============================================================ */
/**
 * Inserta el formulario de cobro dentro de `cont` y devuelve:
 *   setTotal(n)  → actualiza el total (p. ej. si cambian las noches)
 *   leer()       → { pagos, recibido, comprobante } o lanza Error con mensaje
 * opciones: { total, cliente:{doc_tipo,doc,nombre}, comprobante:'boleta'|'ninguno' }
 */
function crearCobro(cont, { total = 0, cliente = {}, comprobante = 'ninguno' } = {}){
  const id = 'cb' + Math.random().toString(36).slice(2, 7);
  let tot = r2(total);
  let metodo = 'Efectivo';
  let tipoComp = comprobante;

  cont.innerHTML = `
    <div class="cobro">
      <div class="cobro-total"><span>Total a cobrar</span><b id="${id}-total">${money(tot)}</b></div>

      <p class="cobro-lbl">Forma de pago</p>
      <div class="metodo-chips" role="radiogroup" aria-label="Forma de pago">
        ${[...METODOS, 'Mixto'].map(m => `
          <button type="button" class="metodo-chip ${METODO_CLASE(m)}${m === metodo ? ' active' : ''}" data-metodo="${m}" role="radio" aria-checked="${m === metodo}">
            ${icon(METODO_IC[m], 16)}<span>${m === 'Mixto' ? 'Pago mixto' : m}</span>
          </button>`).join('')}
      </div>

      <div class="mixto-box hidden" id="${id}-mixto">
        <p class="cobro-ayuda">Reparte el total entre los métodos que usó el cliente (p. ej. mitad Yape y mitad efectivo).</p>
        ${METODOS.map(m => `
          <label class="mixto-fila">
            <span class="mp ${METODO_CLASE(m)}">${icon(METODO_IC[m], 13)} ${m}</span>
            <input type="number" min="0" step="0.10" inputmode="decimal" placeholder="0.00" data-mixto="${m}">
            <button type="button" class="mixto-resto" data-resto="${m}" title="Poner aquí lo que falta">Resto</button>
          </label>`).join('')}
        <div class="mixto-estado" id="${id}-mixto-estado"></div>
      </div>

      <div class="efectivo-box" id="${id}-efbox">
        <label class="cobro-inline">
          <span>Efectivo recibido <small>(opcional, para calcular vuelto)</small></span>
          <input type="number" min="0" step="0.10" inputmode="decimal" placeholder="0.00" id="${id}-recibido">
        </label>
        <div class="vuelto" id="${id}-vuelto"></div>
      </div>

      <p class="cobro-lbl">Comprobante</p>
      <div class="comp-tabs" role="radiogroup" aria-label="Comprobante">
        ${['ninguno', 'boleta', 'factura'].map(t => `<button type="button" class="comp-tab${t === tipoComp ? ' active' : ''}" data-comp="${t}">${{ ninguno: 'Sin comprobante', boleta: 'Boleta', factura: 'Factura' }[t]}</button>`).join('')}
      </div>
      <div class="comp-datos" id="${id}-boleta">
        <div class="modal-grid">
          <div class="field"><label>Documento del cliente</label>
            <div class="doc-row">
              <select id="${id}-bdoctipo"><option value="DNI">DNI</option><option value="CE">C.E.</option><option value="PAS">Pasaporte</option></select>
              <input id="${id}-bdoc" type="text" maxlength="15" placeholder="Opcional" autocomplete="off">
            </div>
          </div>
          <div class="field"><label>Nombre del cliente</label><input id="${id}-bnombre" type="text" maxlength="120" placeholder="Cliente varios"></div>
        </div>
        <p class="cobro-ayuda">Desde S/ 700 la boleta debe llevar el documento y el nombre del cliente.</p>
      </div>
      <div class="comp-datos" id="${id}-factura">
        <div class="modal-grid">
          <div class="field"><label>RUC del cliente</label><input id="${id}-ruc" type="text" maxlength="11" inputmode="numeric" placeholder="20XXXXXXXXX" autocomplete="off"></div>
          <div class="field"><label>Razón social</label><input id="${id}-razon" type="text" maxlength="120" placeholder="Empresa S.A.C."></div>
        </div>
        <div class="field"><label>Dirección fiscal</label><input id="${id}-dir" type="text" maxlength="160" placeholder="Opcional"></div>
      </div>
    </div>`;

  const q = s => cont.querySelector(s);
  // Datos del huésped precargados en la boleta.
  if (cliente.doc_tipo) q(`#${id}-bdoctipo`).value = { 'Carné de Extranjería': 'CE', Pasaporte: 'PAS' }[cliente.doc_tipo] || cliente.doc_tipo;
  if (cliente.doc) q(`#${id}-bdoc`).value = cliente.doc;
  if (cliente.nombre) q(`#${id}-bnombre`).value = cliente.nombre;

  const montosMixto = () => Object.fromEntries(METODOS.map(m => [m, r2(parseFloat(q(`[data-mixto="${m}"]`).value) || 0)]));
  const efectivoACobrar = () => metodo === 'Mixto' ? montosMixto().Efectivo : (metodo === 'Efectivo' ? tot : 0);

  function refrescar(){
    q(`#${id}-total`).textContent = money(tot);
    q(`#${id}-mixto`).classList.toggle('hidden', metodo !== 'Mixto');
    // Estado del pago mixto: falta / excede / cuadra.
    if (metodo === 'Mixto') {
      const suma = r2(Object.values(montosMixto()).reduce((a, b) => a + b, 0));
      const dif = r2(tot - suma);
      const est = q(`#${id}-mixto-estado`);
      est.className = 'mixto-estado ' + (dif === 0 ? 'ok' : 'pend');
      est.innerHTML = dif === 0 ? `${icon('check', 14)} Cuadra: ${money(suma)}`
        : dif > 0 ? `Falta asignar <b>${money(dif)}</b>` : `Excede en <b>${money(-dif)}</b>`;
    }
    // Vuelto
    const ef = efectivoACobrar();
    q(`#${id}-efbox`).classList.toggle('hidden', ef <= 0);
    const rec = parseFloat(q(`#${id}-recibido`).value);
    const v = q(`#${id}-vuelto`);
    if (ef > 0 && rec > 0) {
      v.className = 'vuelto ' + (rec >= ef ? 'ok' : 'mal');
      v.innerHTML = rec >= ef ? `Vuelto: <b>${money(rec - ef)}</b>` : `Faltan <b>${money(ef - rec)}</b> en efectivo`;
    } else { v.innerHTML = ef > 0 ? `En efectivo: <b>${money(ef)}</b>` : ''; v.className = 'vuelto'; }
    // Comprobante
    q(`#${id}-boleta`).classList.toggle('open', tipoComp === 'boleta');
    q(`#${id}-factura`).classList.toggle('open', tipoComp === 'factura');
  }

  cont.querySelectorAll('.metodo-chip').forEach(b => b.addEventListener('click', ()=>{
    metodo = b.dataset.metodo;
    cont.querySelectorAll('.metodo-chip').forEach(x => { x.classList.toggle('active', x === b); x.setAttribute('aria-checked', String(x === b)); });
    if (metodo === 'Mixto' && Object.values(montosMixto()).every(v => !v)) {
      // Propuesta inicial: mitad efectivo, mitad Yape.
      const mitad = r2(tot / 2);
      q('[data-mixto="Efectivo"]').value = mitad.toFixed(2);
      q('[data-mixto="Yape"]').value = r2(tot - mitad).toFixed(2);
    }
    refrescar();
  }));
  cont.querySelectorAll('[data-mixto]').forEach(i => i.addEventListener('input', refrescar));
  cont.querySelectorAll('[data-resto]').forEach(b => b.addEventListener('click', ()=>{
    const m = b.dataset.resto;
    const otros = r2(Object.entries(montosMixto()).filter(([k]) => k !== m).reduce((a, [, v]) => a + v, 0));
    q(`[data-mixto="${m}"]`).value = Math.max(0, r2(tot - otros)).toFixed(2);
    refrescar();
  }));
  q(`#${id}-recibido`).addEventListener('input', refrescar);
  cont.querySelectorAll('.comp-tab').forEach(b => b.addEventListener('click', ()=>{
    tipoComp = b.dataset.comp;
    cont.querySelectorAll('.comp-tab').forEach(x => x.classList.toggle('active', x === b));
    refrescar();
    if (tipoComp === 'factura') setTimeout(()=> q(`#${id}-ruc`).focus(), 50);
  }));
  q(`#${id}-ruc`).addEventListener('input', e => { e.target.value = e.target.value.replace(/\D/g, ''); });
  refrescar();

  return {
    setTotal(n){ tot = r2(n); refrescar(); },
    leer(){
      let pagos;
      if (metodo === 'Mixto') {
        pagos = Object.entries(montosMixto()).filter(([, v]) => v > 0).map(([metodo, monto]) => ({ metodo, monto }));
        const suma = r2(pagos.reduce((a, p) => a + p.monto, 0));
        if (!pagos.length) throw new Error('Indica cuánto pagó con cada método.');
        if (suma !== tot) throw new Error(`El pago mixto suma ${money(suma)} y el total es ${money(tot)}.`);
      } else {
        pagos = [{ metodo, monto: tot }];
      }
      const recRaw = q(`#${id}-recibido`).value;
      const ef = efectivoACobrar();
      const recibido = ef > 0 && recRaw !== '' ? r2(recRaw) : null;
      if (recibido != null && recibido < ef) throw new Error(`El efectivo recibido es menor a ${money(ef)}.`);

      let comp = { tipo: 'ninguno' };
      if (tipoComp === 'boleta') {
        const doc = q(`#${id}-bdoc`).value.trim().toUpperCase();
        const docTipo = q(`#${id}-bdoctipo`).value;
        if (doc && docTipo === 'DNI' && !/^\d{8}$/.test(doc)) throw new Error('El DNI debe tener 8 dígitos.');
        comp = { tipo: 'boleta', doc_tipo: doc ? docTipo : '', doc, nombre: q(`#${id}-bnombre`).value.trim() };
        if (tot >= 700 && (!doc || comp.nombre.length < 3)) throw new Error('Para boletas desde S/ 700 ingresa el documento y el nombre del cliente.');
      } else if (tipoComp === 'factura') {
        const ruc = q(`#${id}-ruc`).value.trim();
        if (!/^(10|15|16|17|20)\d{9}$/.test(ruc)) throw new Error('Ingresa un RUC válido de 11 dígitos para la factura.');
        const razon = q(`#${id}-razon`).value.trim();
        if (razon.length < 3) throw new Error('Ingresa la razón social para la factura.');
        comp = { tipo: 'factura', doc_tipo: 'RUC', doc: ruc, nombre: razon, direccion: q(`#${id}-dir`).value.trim() };
      }
      return { pagos, recibido, comprobante: comp };
    },
  };
}

/** Modal de éxito tras un cobro: muestra el comprobante emitido y permite imprimirlo. */
function mostrarCobroExitoso({ titulo, total, pagos, comprobante, vuelto }){
  openModal(`
    <div class="exito-box">
      <div class="exito-ic">${icon('check', 30)}</div>
      <h3>${escapeHTML(titulo)}</h3>
      <p class="exito-total">${money(total)}</p>
      <div class="exito-pagos">${pagosHTML(pagos, true)}</div>
      ${vuelto != null ? `<p class="exito-vuelto">Vuelto: <b>${money(vuelto)}</b></p>` : ''}
      ${comprobante ? `
        <div class="exito-comp">${icon('recibo', 18)} <span>${comprobante.tipo === 'factura' ? 'Factura' : 'Boleta'} <b>${escapeHTML(comprobante.codigo)}</b> emitida</span></div>
        <div class="modal-actions" style="justify-content:center;">
          <button class="btn" id="ex-cerrar">Listo</button>
          <button class="btn btn-gold" id="ex-imprimir">${icon('imprimir', 15)} Imprimir ${comprobante.tipo}</button>
        </div>` : `
        <div class="modal-actions" style="justify-content:center;"><button class="btn btn-gold" id="ex-cerrar">Listo</button></div>`}
    </div>`);
  $('#ex-cerrar').onclick = closeModal;
  if (comprobante) $('#ex-imprimir').onclick = () => { imprimirComprobante(comprobante.id); closeModal(); };
}

/* ============================================================
   EMITIR COMPROBANTE PARA UN INGRESO YA REGISTRADO
   ============================================================ */
function abrirEmitirComprobante(mov){
  openModal(`
    <h3>Emitir comprobante</h3>
    <p class="modal-sub">${escapeHTML(mov.concepto)} · <b>${money(mov.monto)}</b></p>
    <div id="em-cobro"></div>
    <div class="modal-actions">
      <button class="btn" id="modal-cancel">Cancelar</button>
      <button class="btn btn-gold" id="em-ok">${icon('recibo', 15)} Emitir</button>
    </div>`);
  // Reutilizamos el componente solo por la parte del comprobante.
  const c = crearCobro($('#em-cobro'), { total: mov.monto, comprobante: 'boleta' });
  $('#em-cobro .metodo-chips').previousElementSibling.remove();
  $('#em-cobro .metodo-chips').remove();
  $('#em-cobro .efectivo-box').remove();
  $('#em-cobro .comp-tab[data-comp="ninguno"]').remove();
  $('#modal-cancel').onclick = closeModal;
  $('#em-ok').onclick = async ()=>{
    let datos;
    try { datos = c.leer(); } catch (e) { toast(e.message, true); return; }
    if (datos.comprobante.tipo === 'ninguno') { toast('Elige boleta o factura', true); return; }
    try {
      const { comprobante } = await api('/comprobantes', { method:'POST', body:{ finance_id: mov.id, ...datos.comprobante } });
      mostrarCobroExitoso({ titulo: 'Comprobante emitido', total: mov.monto, pagos: mov.pagos, comprobante });
      renderAll();
    } catch (err) { showError(err); }
  };
}

/* ============================================================
   FINANZAS — resumen del día por método de pago
   ============================================================ */
function metodosCardsHTML(porMetodo, { efectivoExtra } = {}){
  return METODOS.map(m => {
    const v = porMetodo[m] || { ingresos: 0, egresos: 0 };
    const neto = r2((v.ingresos || 0) - (v.egresos || 0));
    return `<div class="mcard ${METODO_CLASE(m)}">
      <div class="mcard-top"><span class="mcard-ic">${icon(METODO_IC[m], 17)}</span><span>${m}</span></div>
      <p class="mcard-neto">${money(neto)}</p>
      <p class="mcard-det"><span class="amount-in">+${Number(v.ingresos || 0).toFixed(2)}</span> · <span class="amount-out">−${Number(v.egresos || 0).toFixed(2)}</span></p>
      ${m === 'Efectivo' && efectivoExtra ? `<p class="mcard-extra">${efectivoExtra}</p>` : ''}
    </div>`;
  }).join('');
}

/* ============================================================
   VISTA "CAJA Y COMPROBANTES"
   ============================================================ */
let cajaActual = null;

async function renderCaja(){
  try{
    const [act, { cierres }] = await Promise.all([ api('/caja/actual'), api('/caja/cierres') ]);
    cajaActual = act;
    const r = act.resumen;
    $('#caja-desde').textContent = act.ultimo
      ? `Desde el cierre N.º ${String(act.ultimo.numero).padStart(4, '0')} · ${fmtDateTime(act.ultimo.hasta)} (${act.ultimo.created_by_nombre})`
      : 'Desde el inicio del sistema (todavía no hay cierres)';
    $('#caja-metodos').innerHTML = metodosCardsHTML(r.por_metodo);
    $('#caja-totales').innerHTML = `
      ${kpi('Ingresos del turno', money(r.totales.ingresos), `${r.totales.movimientos} movimiento(s)`, '', 'finanzas')}
      ${kpi('Egresos del turno', money(r.totales.egresos), 'Gastos pagados', '', 'gasto')}
      ${kpi('Neto del turno', money(r.totales.neto), 'Ingresos − egresos', r.totales.neto < 0 ? 'danger-border' : '', 'wallet')}
      ${kpi('Comprobantes', r.comprobantes.boletas + r.comprobantes.facturas, `${r.comprobantes.boletas} boleta(s) · ${r.comprobantes.facturas} factura(s)`, '', 'recibo')}`;
    animarKpis($('#caja-totales'));

    const movs = [...r.movimientos].reverse();
    $('#tbl-caja-movs').innerHTML = movs.map(m => `
      <tr>
        <td>${fmtDateTime(m.hora).split(' · ')[1]}</td>
        <td>${escapeHTML(m.concepto)}<small class="td-sub">${escapeHTML(m.usuario)}</small></td>
        <td>${pagosHTML(m.pagos)}</td>
        <td class="${m.tipo === 'ingreso' ? 'amount-in' : 'amount-out'}">${m.tipo === 'ingreso' ? '+' : '−'}${money(m.monto)}</td>
      </tr>`).join('') || `<tr><td colspan="4" class="empty-note">Aún no hay movimientos en este turno.</td></tr>`;

    $('#tbl-cierres').innerHTML = cierres.map(c => {
      const d = c.diferencia;
      const pill = d === null || d === undefined ? '<span class="pill">Sin conteo</span>'
        : d === 0 ? '<span class="pill pill-ok">Cuadra</span>'
        : d > 0 ? `<span class="pill pill-warn">Sobra ${money(d)}</span>` : `<span class="pill pill-danger">Falta ${money(-d)}</span>`;
      return `<tr>
        <td class="b">${String(c.numero).padStart(4, '0')}${c.tipo === 'general' ? '<small class="td-sub tag-general">GENERAL</small>' : '<small class="td-sub">Turno</small>'}</td>
        <td>${fmtDateTime(c.hasta)}<small class="td-sub">${escapeHTML(c.created_by_nombre)}</small></td>
        <td class="${c.totales.neto >= 0 ? 'amount-in' : 'amount-out'}">${money(c.totales.neto)}</td>
        <td>${pill}</td>
        <td><button class="btn btn-sm" data-ticket="${c.id}">${icon('imprimir', 14)} Ticket</button></td>
      </tr>`;
    }).join('') || `<tr><td colspan="5" class="empty-note">Todavía no se ha hecho ningún cierre de caja.</td></tr>`;
    $$('#tbl-cierres [data-ticket]').forEach(b => b.onclick = () => imprimirCierre(b.dataset.ticket));

    renderComprobantes();
  }catch(err){ showError(err); }
}

async function renderComprobantes(){
  const tipo = $('#comp-tipo').value;
  const q = $('#comp-buscar').value.trim();
  const desde = $('#comp-desde').value, hasta = $('#comp-hasta').value;
  const qs = new URLSearchParams(Object.entries({ tipo, q, desde, hasta }).filter(([, v]) => v)).toString();
  try{
    const { comprobantes } = await api('/comprobantes' + (qs ? '?' + qs : ''));
    const esAdmin = session.role === 'admin';
    $('#tbl-comprobantes').innerHTML = comprobantes.map(c => `
      <tr class="${c.estado === 'anulado' ? 'row-anulado' : ''}">
        <td class="b">${escapeHTML(c.codigo)}<small class="td-sub">${c.tipo === 'factura' ? 'Factura' : 'Boleta'}</small></td>
        <td>${fmtDateTime(c.created_at)}</td>
        <td>${escapeHTML(c.cliente_nombre)}${c.cliente_doc ? `<small class="td-sub">${escapeHTML(c.cliente_doc_tipo || '')} ${escapeHTML(c.cliente_doc)}</small>` : ''}</td>
        <td>${pagosHTML(c.pagos)}</td>
        <td class="b">${money(c.total)}</td>
        <td>${c.estado === 'anulado' ? `<span class="pill pill-danger" title="${escapeHTML(c.motivo_anulacion || '')}">Anulado</span>` : '<span class="pill pill-ok">Emitido</span>'}</td>
        <td class="td-acciones">
          <button class="btn btn-sm" data-print="${c.id}" title="Imprimir">${icon('imprimir', 14)}</button>
          ${esAdmin && c.estado !== 'anulado' ? `<button class="btn btn-sm btn-danger" data-anular="${c.id}" data-codigo="${escapeHTML(c.codigo)}">Anular</button>` : ''}
        </td>
      </tr>`).join('') || `<tr><td colspan="7" class="empty-note">No hay comprobantes${qs ? ' con esos filtros' : ' emitidos todavía'}.</td></tr>`;
    $$('#tbl-comprobantes [data-print]').forEach(b => b.onclick = () => imprimirComprobante(b.dataset.print));
    $$('#tbl-comprobantes [data-anular]').forEach(b => b.onclick = () => anularComprobante(b.dataset.anular, b.dataset.codigo));
  }catch(err){ showError(err); }
}

function anularComprobante(id, codigo){
  openModal(`
    <div class="confirm-box">
      <div class="confirm-ic">${icon('recibo', 24)}</div>
      <h3>¿Anular ${escapeHTML(codigo)}?</h3>
      <p>El comprobante quedará marcado como ANULADO. El dinero cobrado sigue registrado en caja.</p>
    </div>
    <div class="field" style="margin-top:14px;"><label>Motivo de la anulación</label><input id="an-motivo" type="text" maxlength="200" placeholder="Ej. Error en el RUC del cliente"></div>
    <div class="modal-actions">
      <button class="btn" id="modal-cancel">Cancelar</button>
      <button class="btn btn-danger-solid" id="an-ok">Anular comprobante</button>
    </div>`);
  $('#modal-cancel').onclick = closeModal;
  $('#an-ok').onclick = async ()=>{
    const motivo = $('#an-motivo').value.trim();
    if (motivo.length < 3) { toast('Indica el motivo de la anulación', true); return; }
    try { await api(`/comprobantes/${id}/anular`, { method:'PATCH', body:{ motivo } }); closeModal(); toast(`${codigo} anulado`, 'success'); renderAll(); }
    catch (err) { showError(err); }
  };
}

['#comp-tipo', '#comp-desde', '#comp-hasta'].forEach(s => $(s)?.addEventListener('change', renderComprobantes));
let compBuscarTimer;
$('#comp-buscar')?.addEventListener('input', ()=>{ clearTimeout(compBuscarTimer); compBuscarTimer = setTimeout(renderComprobantes, 300); });

/* ---------- Cierre de caja ---------- */
/**
 * Cierre de TURNO (recepción, al terminar su turno) o cierre GENERAL
 * (administrador, cuando la dueña pide "saquemos cuentas hasta hoy":
 * incluye todos los turnos y deja en cero los totales de Finanzas).
 */
async function abrirCierre(tipo){
  const general = tipo === 'general';
  let act;
  try { act = await api('/caja/actual?tipo=' + tipo); } catch (err) { showError(err); return; }
  const r = act.resumen;
  const efNeto = r.por_metodo.Efectivo ? r.por_metodo.Efectivo.neto : 0;
  const metodos = Object.entries(r.por_metodo).filter(([, v]) => v.ingresos || v.egresos);
  const desdeTxt = act.ultimo
    ? `Desde el ${general ? 'cierre general' : 'cierre'} N.º ${String(act.ultimo.numero).padStart(4, '0')} (${fmtDateTime(act.ultimo.hasta)})`
    : 'Desde el inicio del sistema';

  openModal(`
    <h3>${general ? 'Cierre general de cuentas' : 'Cierre de caja del turno'}</h3>
    <p class="modal-sub">${escapeHTML(desdeTxt)} hasta ahora · ${r.totales.movimientos} movimiento(s)${general ? ` · ${r.turnos_incluidos} cierre(s) de turno incluidos` : ''}</p>
    ${general ? `<div class="alert-banner" style="margin:0 0 14px;">${icon('info', 20)}<div>Se liquidan <b>todas las cuentas hasta hoy</b>. Después del cierre, los totales de Finanzas y la caja vuelven a <b>S/ 0.00</b>. El historial completo se conserva en el Excel y en los tickets.</div></div>` : ''}
    <div class="cierre-tabla">
      <div class="ct-head"><span>Método</span><span>Ingresos</span><span>Egresos</span><span>Neto</span></div>
      ${metodos.length ? metodos.map(([m, v]) => `
        <div class="ct-row"><span class="mp ${METODO_CLASE(m)}">${icon(METODO_IC[m] || 'wallet', 13)} ${escapeHTML(m)}</span>
          <span class="amount-in">${v.ingresos.toFixed(2)}</span><span class="amount-out">${v.egresos.toFixed(2)}</span><b>${v.neto.toFixed(2)}</b></div>`).join('')
        : '<p class="empty-note" style="text-align:center;">No hay movimientos desde el último cierre.</p>'}
      <div class="ct-total"><span>TOTAL</span><span class="amount-in">${r.totales.ingresos.toFixed(2)}</span><span class="amount-out">${r.totales.egresos.toFixed(2)}</span><b>${money(r.totales.neto)}</b></div>
    </div>
    <div class="modal-grid" style="margin-top:14px;">
      <div class="field"><label>Fondo inicial de caja (S/)</label><input id="ci-fondo" type="number" min="0" step="0.10" value="${Number(act.fondo_sugerido || 0).toFixed(2)}"></div>
      <div class="field"><label>Efectivo contado (S/)</label><input id="ci-contado" type="number" min="0" step="0.10" placeholder="Cuenta los billetes y monedas"></div>
    </div>
    <div class="cierre-cuadre" id="ci-cuadre"></div>
    <div class="field"><label>Observaciones</label><input id="ci-obs" type="text" maxlength="300" placeholder="Opcional (ej. se retiró S/ 500 para depósito)"></div>
    <div class="modal-actions">
      <button class="btn" id="modal-cancel">Cancelar</button>
      <button class="btn btn-gold" id="ci-ok">${icon('caja', 15)} ${general ? 'Hacer cierre general' : 'Cerrar caja del turno'}</button>
    </div>`, { wide: true });

  const cuadre = ()=>{
    const fondo = parseFloat($('#ci-fondo').value) || 0;
    const esperado = r2(fondo + efNeto);
    const contadoRaw = $('#ci-contado').value;
    let res = '';
    if (contadoRaw !== '') {
      const d = r2(parseFloat(contadoRaw) - esperado);
      res = d === 0 ? `<span class="pill pill-ok">${icon('check', 12)} Cuadra exacto</span>`
        : d > 0 ? `<span class="pill pill-warn">Sobrante ${money(d)}</span>` : `<span class="pill pill-danger">Faltante ${money(-d)}</span>`;
    }
    $('#ci-cuadre').innerHTML = `
      <div><small>Fondo inicial</small><b>${money(fondo)}</b></div>
      <div><small>+ Efectivo neto</small><b>${money(efNeto)}</b></div>
      <div class="cc-esperado"><small>= Debe haber en caja</small><b>${money(esperado)}</b></div>
      <div class="cc-res">${res || '<small>Ingresa el efectivo contado para ver si cuadra</small>'}</div>`;
  };
  ['#ci-fondo', '#ci-contado'].forEach(s => $(s).addEventListener('input', cuadre));
  cuadre();
  $('#modal-cancel').onclick = closeModal;
  $('#ci-ok').onclick = async ()=>{
    const contado = $('#ci-contado').value;
    if (general) {
      const ok = await confirmDialog({ title:'¿Hacer el cierre general?', message:`Se liquidarán ${money(r.totales.neto)} netos y los totales volverán a S/ 0.00. Esta acción no se puede deshacer.`, confirmText:'Sí, cerrar cuentas', danger:false, iconName:'caja' });
      if (!ok) return;
    } else if (contado === '') {
      const seguir = await confirmDialog({ title:'¿Cerrar sin contar el efectivo?', message:'El ticket no mostrará si hubo sobrante o faltante. Se recomienda contar el dinero antes de cerrar.', confirmText:'Cerrar igual', danger:false, iconName:'caja' });
      if (!seguir) return;
    }
    try{
      const { cierre } = await api('/caja/cerrar', { method:'POST', body:{
        tipo,
        fondo_inicial: parseFloat($('#ci-fondo')?.value) || 0,
        efectivo_contado: contado === '' ? null : parseFloat(contado),
        observaciones: $('#ci-obs')?.value.trim() || '',
      }});
      const rs = cierre.resumen;
      const d = rs.diferencia;
      openModal(`
        <div class="exito-box">
          <div class="exito-ic">${icon('caja', 28)}</div>
          <h3>${general ? 'Cierre general' : 'Cierre de caja'} N.º ${String(cierre.numero).padStart(4, '0')}</h3>
          <p class="exito-total">${money(rs.totales.neto)}</p>
          <p class="modal-sub" style="margin:0 0 10px;">${general ? 'Neto liquidado · las cuentas vuelven a S/ 0.00' : 'Neto del turno'} · Efectivo esperado ${money(rs.efectivo_esperado)}</p>
          ${d === null ? '' : d === 0 ? '<span class="pill pill-ok">La caja cuadra</span>'
            : d > 0 ? `<span class="pill pill-warn">Sobrante ${money(d)}</span>` : `<span class="pill pill-danger">Faltante ${money(-d)}</span>`}
          <div class="modal-actions" style="justify-content:center;">
            <button class="btn" id="ex-cerrar">Listo</button>
            <button class="btn btn-gold" id="ex-imprimir">${icon('imprimir', 15)} Imprimir ticket</button>
          </div>
        </div>`);
      $('#ex-cerrar').onclick = closeModal;
      $('#ex-imprimir').onclick = () => { imprimirCierre(cierre.id); closeModal(); };
      renderAll();
    }catch(err){ showError(err); }
  };
}
$('#btn-cierre')?.addEventListener('click', ()=> abrirCierre('turno'));
$('#btn-cierre-general')?.addEventListener('click', ()=> abrirCierre('general'));

/* ============================================================
   CONFIGURACIÓN (admin) — datos del hostal y usuarios
   ============================================================ */
const CAMPOS_AJUSTES = ['nombre_comercial', 'razon_social', 'ruc', 'direccion', 'telefono', 'email', 'serie_boleta', 'serie_factura', 'igv_porcentaje', 'mensaje_pie'];

async function renderAdminConfig(){
  const bloques = $$('.admin-only-cfg');
  bloques.forEach(b => b.classList.toggle('hidden', session.role !== 'admin'));
  if (session.role !== 'admin') return;
  try{
    const [{ ajustes }, { users }] = await Promise.all([ api('/ajustes'), api('/users') ]);
    CAMPOS_AJUSTES.forEach(k => { const el = $('#aj-' + k); if (el) el.value = ajustes[k] ?? ''; });
    $('#tbl-usuarios').innerHTML = users.map(u => `
      <tr class="${u.activo ? '' : 'row-anulado'}">
        <td><div class="usr-cell"><span class="usr-av">${escapeHTML(u.nombre.charAt(0).toUpperCase())}</span><div><b>${escapeHTML(u.nombre)}</b><small class="td-sub">@${escapeHTML(u.username)}</small></div></div></td>
        <td>${u.role === 'admin' ? '<span class="pill pill-warn">Administrador</span>' : '<span class="pill">Recepcionista</span>'}</td>
        <td>${u.activo ? '<span class="pill pill-ok">Activo</span>' : '<span class="pill pill-danger">Desactivado</span>'}</td>
        <td class="td-acciones">
          <button class="btn btn-sm" data-u-edit="${u.id}">${icon('editar', 13)} Editar</button>
          <button class="btn btn-sm" data-u-pass="${u.id}">${icon('llave', 13)} Contraseña</button>
          ${u.id !== session.id ? `<button class="btn btn-sm ${u.activo ? 'btn-danger' : ''}" data-u-toggle="${u.id}">${u.activo ? 'Desactivar' : 'Activar'}</button>` : '<span class="td-sub">(tú)</span>'}
        </td>
      </tr>`).join('');
    const porId = Object.fromEntries(users.map(u => [u.id, u]));
    $$('[data-u-edit]').forEach(b => b.onclick = () => abrirUsuario(porId[b.dataset.uEdit]));
    $$('[data-u-pass]').forEach(b => b.onclick = () => abrirPasswordUsuario(porId[b.dataset.uPass]));
    $$('[data-u-toggle]').forEach(b => b.onclick = async ()=>{
      const u = porId[b.dataset.uToggle];
      if (u.activo) {
        const ok = await confirmDialog({ title:`¿Desactivar a ${u.nombre}?`, message:'Ya no podrá ingresar al sistema y su sesión se cerrará de inmediato. Su historial se conserva.', confirmText:'Desactivar' });
        if (!ok) return;
      }
      try { await api(`/users/${u.id}`, { method:'PATCH', body:{ activo: !u.activo } }); toast(u.activo ? `${u.nombre} desactivado` : `${u.nombre} activado`, 'success'); renderAdminConfig(); }
      catch (err) { showError(err); }
    });
  }catch(err){ showError(err); }
}

function abrirUsuario(u){
  const nuevo = !u;
  openModal(`
    <h3>${nuevo ? 'Agregar usuario' : 'Editar usuario'}</h3>
    <p class="modal-sub">${nuevo ? 'Crea el acceso de un nuevo recepcionista (o administrador).' : '@' + escapeHTML(u.username)}</p>
    <div class="field"><label>Nombre completo</label><input id="us-nombre" type="text" maxlength="60" placeholder="Ej. Lucía Mamani" value="${nuevo ? '' : escapeHTML(u.nombre)}"></div>
    ${nuevo ? `
      <div class="field"><label>Usuario para ingresar</label><input id="us-username" type="text" maxlength="30" autocapitalize="none" spellcheck="false" placeholder="Ej. lucia"></div>
      <div class="modal-grid">
        <div class="field"><label>Contraseña</label><input id="us-pass" type="password" maxlength="128" autocomplete="new-password" placeholder="Mínimo 8 caracteres"></div>
        <div class="field"><label>Confirmar contraseña</label><input id="us-pass2" type="password" maxlength="128" autocomplete="new-password"></div>
      </div>` : ''}
    <div class="field"><label>Rol</label>
      <select id="us-role"><option value="recepcion">Recepcionista</option><option value="admin">Administrador</option></select>
    </div>
    <p class="modal-note">Recepcionista: check-in/out, cobros, ventas, gastos y cierre de caja. Administrador: además finanzas, inventario, anulaciones, usuarios y configuración.</p>
    <div class="modal-actions">
      <button class="btn" id="modal-cancel">Cancelar</button>
      <button class="btn btn-gold" id="us-ok">${nuevo ? 'Crear usuario' : 'Guardar cambios'}</button>
    </div>`);
  $('#us-role').value = nuevo ? 'recepcion' : u.role;
  if (!nuevo && u.id === session.id) $('#us-role').disabled = true;
  $('#modal-cancel').onclick = closeModal;
  $('#us-username')?.addEventListener('input', e => { e.target.value = e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ''); });
  $('#us-ok').onclick = async ()=>{
    const nombre = $('#us-nombre').value.trim();
    if (nombre.length < 2) { toast('Escribe el nombre del usuario', true); return; }
    try{
      if (nuevo) {
        const username = $('#us-username').value.trim();
        const pass = $('#us-pass').value, pass2 = $('#us-pass2').value;
        if (username.length < 3) { toast('El usuario debe tener al menos 3 caracteres', true); return; }
        if (pass.length < 8) { toast('La contraseña debe tener al menos 8 caracteres', true); return; }
        if (pass !== pass2) { toast('Las contraseñas no coinciden', true); return; }
        await api('/users', { method:'POST', body:{ nombre, username, password: pass, role: $('#us-role').value } });
        toast(`Usuario "${username}" creado. Ya puede ingresar como ${$('#us-role').value === 'admin' ? 'Administrador' : 'Recepcionista'}.`, 'success');
      } else {
        const body = { nombre };
        if (u.id !== session.id) body.role = $('#us-role').value;
        await api(`/users/${u.id}`, { method:'PATCH', body });
        toast('Usuario actualizado', 'success');
      }
      closeModal(); renderAdminConfig();
    }catch(err){ showError(err); }
  };
}

function abrirPasswordUsuario(u){
  openModal(`
    <h3>Restablecer contraseña</h3>
    <p class="modal-sub">${escapeHTML(u.nombre)} · @${escapeHTML(u.username)}</p>
    <div class="modal-grid">
      <div class="field"><label>Nueva contraseña</label><input id="up-pass" type="password" maxlength="128" autocomplete="new-password" placeholder="Mínimo 8 caracteres"></div>
      <div class="field"><label>Confirmar</label><input id="up-pass2" type="password" maxlength="128" autocomplete="new-password"></div>
    </div>
    <p class="modal-note">Las sesiones abiertas de este usuario se cerrarán y deberá ingresar con la nueva contraseña.</p>
    <div class="modal-actions">
      <button class="btn" id="modal-cancel">Cancelar</button>
      <button class="btn btn-gold" id="up-ok">Guardar contraseña</button>
    </div>`);
  $('#modal-cancel').onclick = closeModal;
  $('#up-ok').onclick = async ()=>{
    const p1 = $('#up-pass').value, p2 = $('#up-pass2').value;
    if (p1.length < 8) { toast('La contraseña debe tener al menos 8 caracteres', true); return; }
    if (p1 !== p2) { toast('Las contraseñas no coinciden', true); return; }
    try { await api(`/users/${u.id}`, { method:'PATCH', body:{ password: p1 } }); closeModal(); toast(`Contraseña de ${u.nombre} actualizada`, 'success'); }
    catch (err) { showError(err); }
  };
}

$('#btn-add-user')?.addEventListener('click', ()=> abrirUsuario(null));
$('#btn-guardar-ajustes')?.addEventListener('click', async ()=>{
  const body = Object.fromEntries(CAMPOS_AJUSTES.map(k => [k, ($('#aj-' + k)?.value || '').trim()]));
  try { await api('/ajustes', { method:'PUT', body }); toast('Datos del hostal guardados. Saldrán en los próximos comprobantes.', 'success'); }
  catch (err) { showError(err); }
});
