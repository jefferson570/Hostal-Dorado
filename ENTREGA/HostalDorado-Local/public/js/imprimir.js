/**
 * imprimir.js
 * ---------------------------------------------------------------
 * Vista de impresión de:
 *   /imprimir.html?c=<id>        → boleta o factura
 *   /imprimir.html?cierre=<id>   → ticket de cierre de caja
 * Agrega &auto=1 para abrir el diálogo de impresión automáticamente.
 * Usa la misma sesión del panel (token guardado en este navegador).
 */
(function () {
  const $ = s => document.querySelector(s);
  const params = new URLSearchParams(location.search);
  const papel = $('#papel');

  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = n => 'S/ ' + Number(n || 0).toFixed(2);
  const num = n => Number(n || 0).toFixed(2);
  const fecha = iso => new Date(iso).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const hora = iso => new Date(iso).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  const fechaHora = iso => `${fecha(iso)} ${hora(iso)}`;

  /* ---------- Formato de papel ---------- */
  let pageStyle = document.createElement('style');
  document.head.appendChild(pageStyle);
  function aplicarFormato(f) {
    document.body.classList.remove('f80', 'f58', 'fa4');
    document.body.classList.add('f' + f);
    pageStyle.textContent = f === 'a4'
      ? '@page{size:A4;margin:12mm;}'
      : `@page{size:${f}mm auto;margin:0;}`;
    try { localStorage.setItem('dorado_formato_impresion', f); } catch (_) { /* sin storage */ }
  }
  let formato = '80';
  try { formato = localStorage.getItem('dorado_formato_impresion') || '80'; } catch (_) { /* sin storage */ }
  $('#formato').value = formato;
  aplicarFormato(formato);
  $('#formato').addEventListener('change', e => aplicarFormato(e.target.value));
  $('#btn-imprimir').addEventListener('click', () => window.print());
  $('#btn-cerrar').addEventListener('click', () => { window.close(); setTimeout(() => { location.href = '/'; }, 150); });

  /* ---------- Monto en letras (Perú: "CIENTO VEINTE Y 50/100 SOLES") ---------- */
  const U = ['', 'UNO', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE', 'DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE',
    'DIECISÉIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE', 'VEINTE', 'VEINTIUNO', 'VEINTIDÓS', 'VEINTITRÉS', 'VEINTICUATRO', 'VEINTICINCO',
    'VEINTISÉIS', 'VEINTISIETE', 'VEINTIOCHO', 'VEINTINUEVE'];
  const D = ['', '', '', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
  const C = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];
  function menorMil(n) {
    if (n === 0) return '';
    if (n === 100) return 'CIEN';
    const c = Math.floor(n / 100), r = n % 100;
    let t = C[c];
    if (r) t += (t ? ' ' : '') + (r < 30 ? U[r] : D[Math.floor(r / 10)] + (r % 10 ? ' Y ' + U[r % 10] : ''));
    return t;
  }
  function enLetras(monto) {
    const entero = Math.floor(Math.round(monto * 100) / 100);
    const cent = Math.round((monto - entero) * 100);
    let t;
    if (entero === 0) t = 'CERO';
    else {
      const millones = Math.floor(entero / 1e6), miles = Math.floor((entero % 1e6) / 1000), resto = entero % 1000;
      t = [
        millones ? (millones === 1 ? 'UN MILLÓN' : menorMil(millones) + ' MILLONES') : '',
        miles ? (miles === 1 ? 'MIL' : menorMil(miles).replace(/VEINTIUNO$/, 'VEINTIÚN').replace(/UNO$/, 'UN') + ' MIL') : '',
        menorMil(resto),
      ].filter(Boolean).join(' ');
    }
    return `${t} Y ${String(cent).padStart(2, '0')}/100 SOLES`;
  }

  /* ---------- Cabecera del emisor ---------- */
  function cabecera(e) {
    return `
      <img class="logo" src="/img/logo.svg" alt="">
      <div class="c">
        <p class="emisor-nombre">${esc((e.nombre_comercial || 'Hostal Dorado').toUpperCase())}</p>
        ${e.razon_social && e.razon_social.toUpperCase() !== (e.nombre_comercial || '').toUpperCase() ? `<p class="emisor-dato">${esc(e.razon_social)}</p>` : ''}
        ${e.ruc ? `<p class="emisor-dato b">RUC ${esc(e.ruc)}</p>` : ''}
        ${e.direccion ? `<p class="emisor-dato">${esc(e.direccion)}</p>` : ''}
        ${e.telefono ? `<p class="emisor-dato">Tel. ${esc(e.telefono)}</p>` : ''}
        ${e.email ? `<p class="emisor-dato">${esc(e.email)}</p>` : ''}
      </div>`;
  }

  /* ---------- Boleta / factura ---------- */
  function renderComprobante(c) {
    const e = c.emisor || {};
    const esFactura = c.tipo === 'factura';
    document.title = `${c.codigo} · ${esFactura ? 'Factura' : 'Boleta'} · Hostal Dorado`;
    $('#tb-titulo').textContent = `${esFactura ? 'Factura' : 'Boleta de venta'} ${c.codigo}`;
    papel.classList.toggle('anulado', c.estado === 'anulado');
    const docLbl = { DNI: 'DNI', CE: 'C.E.', PAS: 'PASAPORTE', RUC: 'RUC' }[c.cliente_doc_tipo] || 'DOC.';

    papel.innerHTML = `
      ${cabecera(e)}
      <div class="doc-box">
        <div class="doc-tipo">${esFactura ? 'FACTURA' : 'BOLETA DE VENTA'}</div>
        <div class="doc-num">${esc(c.codigo)}</div>
      </div>
      <div class="fila"><span class="etq">Fecha de emisión:</span><span>${fecha(c.created_at)}</span></div>
      <div class="fila"><span class="etq">Hora:</span><span>${hora(c.created_at)}</span></div>
      <div class="fila"><span class="etq">Moneda:</span><span>SOLES (PEN)</span></div>
      <hr class="sep">
      <div class="fila"><span class="etq">${esFactura ? 'Razón social:' : 'Cliente:'}</span><span class="b">${esc(c.cliente_nombre)}</span></div>
      ${c.cliente_doc ? `<div class="fila"><span class="etq">${docLbl}:</span><span>${esc(c.cliente_doc)}</span></div>` : ''}
      ${c.cliente_direccion ? `<div class="fila"><span class="etq">Dirección:</span><span>${esc(c.cliente_direccion)}</span></div>` : ''}
      <hr class="sep">
      <table>
        <thead><tr><th>Cant.</th><th>Descripción</th><th class="r">Importe</th></tr></thead>
        <tbody>
          ${c.items.map(i => `
            <tr class="item-desc"><td>${esc(i.cantidad)}</td><td>${esc(i.descripcion)}</td><td class="r">${num(i.importe)}</td></tr>
            <tr class="item-num"><td></td><td colspan="2">${esc(i.unidad)} x ${num(i.precio_unitario)}</td></tr>`).join('')}
        </tbody>
      </table>
      <hr class="sep">
      ${c.igv_pct > 0 ? `
        <div class="fila"><span>Op. gravada</span><span>${money(c.subtotal)}</span></div>
        <div class="fila"><span>IGV (${Number(c.igv_pct)}%)</span><span>${money(c.igv)}</span></div>` : ''}
      <div class="fila total-grande"><span>TOTAL</span><span>${money(c.total)}</span></div>
      <p class="b" style="font-size:.9em;margin:1.5mm 0 0">SON: ${esc(enLetras(c.total))}</p>
      <hr class="sep">
      <p class="seccion">FORMA DE PAGO</p>
      ${c.pagos.map(p => `<div class="fila"><span>${esc(p.metodo)}</span><span>${money(p.monto)}</span></div>`).join('')}
      ${c.recibido != null ? `
        <div class="fila"><span class="etq">Efectivo recibido</span><span>${money(c.recibido)}</span></div>
        <div class="fila b"><span>Vuelto</span><span>${money(c.vuelto)}</span></div>` : ''}
      <hr class="sep">
      <div class="fila"><span class="etq">Atendido por:</span><span>${esc(c.created_by_nombre)}</span></div>
      ${c.estado === 'anulado' ? `<p class="c b" style="margin-top:2mm">COMPROBANTE ANULADO</p><p class="nota">${esc(c.motivo_anulacion || '')}</p>` : ''}
      <hr class="sep-doble">
      <p class="pie">${esc(e.mensaje_pie || '¡Gracias por su preferencia!')}</p>
      <p class="nota">${esc((e.nombre_comercial || 'Hostal Dorado'))} · ${fechaHora(c.created_at)}</p>`;
  }

  /* ---------- Ticket de cierre de caja ---------- */
  function renderCierre(ci) {
    const r = ci.resumen;
    const e = r.emisor || {};
    const n = String(ci.numero).padStart(4, '0');
    const general = (ci.tipo || r.tipo) === 'general';
    const titulo = general ? 'CIERRE GENERAL' : 'CIERRE DE CAJA';
    document.title = `${general ? 'Cierre general' : 'Cierre de caja'} N.º ${n} · Hostal Dorado`;
    $('#tb-titulo').textContent = `${general ? 'Cierre general' : 'Cierre de caja'} N.º ${n}`;
    const metodos = Object.entries(r.por_metodo).filter(([, v]) => v.ingresos || v.egresos);
    const dif = r.diferencia;
    const estadoDif = dif === null ? '' : dif === 0 ? 'CUADRA' : dif > 0 ? `SOBRANTE ${money(dif)}` : `FALTANTE ${money(-dif)}`;

    papel.innerHTML = `
      ${cabecera(e)}
      <div class="doc-box">
        <div class="doc-tipo">${titulo}</div>
        <div class="doc-num">N.º ${n}</div>
        ${general ? '<div style="font-size:.85em;margin-top:1mm">Liquidación de cuentas · totales a cero</div>' : ''}
      </div>
      <div class="fila"><span class="etq">Desde:</span><span>${r.desde.startsWith('1970') ? 'Inicio del sistema' : fechaHora(r.desde)}</span></div>
      <div class="fila"><span class="etq">Hasta:</span><span>${fechaHora(r.hasta)}</span></div>
      <div class="fila"><span class="etq">Cerrado por:</span><span>${esc(ci.created_by_nombre)}</span></div>
      <div class="fila"><span class="etq">Movimientos:</span><span>${r.totales.movimientos}</span></div>
      ${general ? `<div class="fila"><span class="etq">Cierres de turno incluidos:</span><span>${r.turnos_incluidos || 0}</span></div>` : ''}

      <hr class="sep">
      <p class="seccion">RESUMEN POR MÉTODO DE PAGO</p>
      <table>
        <thead><tr><th>Método</th><th class="r">Ingreso</th><th class="r">Egreso</th><th class="r">Neto</th></tr></thead>
        <tbody>
          ${metodos.length ? metodos.map(([m, v]) => `<tr><td>${esc(m)}</td><td class="r">${num(v.ingresos)}</td><td class="r">${num(v.egresos)}</td><td class="r b">${num(v.neto)}</td></tr>`).join('')
            : '<tr><td colspan="4" class="c">Sin movimientos</td></tr>'}
        </tbody>
      </table>

      <hr class="sep">
      <p class="seccion">TOTALES</p>
      <div class="fila"><span>(+) Total ingresos</span><span>${money(r.totales.ingresos)}</span></div>
      <div class="fila"><span>(−) Total egresos</span><span>${money(r.totales.egresos)}</span></div>
      <div class="fila total-grande"><span>${general ? 'NETO LIQUIDADO' : 'NETO DEL TURNO'}</span><span>${money(r.totales.neto)}</span></div>

      <hr class="sep">
      <p class="seccion">POR CONCEPTO</p>
      <div class="fila"><span>Hospedaje</span><span>${money(r.categorias.hospedaje)}</span></div>
      <div class="fila"><span>Venta de productos</span><span>${money(r.categorias.ventas)}</span></div>
      <div class="fila"><span>Otros ingresos</span><span>${money(r.categorias.otros_ingresos)}</span></div>
      <div class="fila"><span>Gastos / egresos</span><span>−${money(r.categorias.egresos)}</span></div>

      <hr class="sep">
      <p class="seccion">EFECTIVO EN CAJA</p>
      <div class="fila"><span>Fondo inicial</span><span>${money(r.fondo_inicial)}</span></div>
      <div class="fila"><span>(+) Efectivo neto del turno</span><span>${money(r.por_metodo.Efectivo ? r.por_metodo.Efectivo.neto : 0)}</span></div>
      <div class="fila b"><span>= Efectivo esperado</span><span>${money(r.efectivo_esperado)}</span></div>
      ${r.efectivo_contado !== null ? `
        <div class="fila"><span>Efectivo contado</span><span>${money(r.efectivo_contado)}</span></div>
        <div class="fila" style="margin-top:1.5mm"><span>Resultado</span><span class="estado-diff">${esc(estadoDif)}</span></div>` : '<p class="nota">No se registró el conteo físico del efectivo.</p>'}
      <div class="fila" style="margin-top:1.5mm"><span class="etq">Digital (Yape, Plin, tarjeta, transf.)</span><span>${money(metodos.filter(([m]) => m !== 'Efectivo').reduce((a, [, v]) => a + v.neto, 0))}</span></div>

      <hr class="sep">
      <p class="seccion">COMPROBANTES</p>
      <div class="fila"><span>Boletas emitidas</span><span>${r.comprobantes.boletas}</span></div>
      <div class="fila"><span>Facturas emitidas</span><span>${r.comprobantes.facturas}</span></div>
      <div class="fila"><span>Anulados</span><span>${r.comprobantes.anulados}</span></div>
      <div class="fila"><span>Total comprobado</span><span>${money(r.comprobantes.total_emitido)}</span></div>

      <hr class="sep">
      <p class="seccion">DETALLE DE MOVIMIENTOS</p>
      ${r.movimientos.length ? `<table>
        <tbody>
          ${r.movimientos.map(m => `
            <tr class="item-desc"><td style="width:13mm">${hora(m.hora).slice(0, 5)}</td><td>${esc(m.concepto)}</td><td class="r">${m.tipo === 'egreso' ? '−' : ''}${num(m.monto)}</td></tr>
            <tr class="item-num"><td></td><td colspan="2">${esc(m.pagos.map(p => m.pagos.length > 1 ? `${p.metodo} ${num(p.monto)}` : p.metodo).join(' + '))} · ${esc(m.usuario)}</td></tr>`).join('')}
        </tbody>
      </table>` : '<p class="c">Sin movimientos en este turno.</p>'}

      ${ci.observaciones ? `<hr class="sep"><p class="seccion">OBSERVACIONES</p><p>${esc(ci.observaciones)}</p>` : ''}

      <div class="firmas"><div>Entregué conforme<br>${esc(ci.created_by_nombre)}</div><div>Recibí conforme</div></div>
      <hr class="sep-doble">
      <p class="nota">Impreso el ${fechaHora(new Date().toISOString())}</p>`;
  }

  /* ---------- Carga ---------- */
  async function cargar() {
    let token = null;
    try { token = localStorage.getItem('dorado_token'); } catch (_) { /* sin storage */ }
    if (!token) { papel.innerHTML = '<p class="error">Inicia sesión en el panel para imprimir.</p>'; return; }
    const c = params.get('c'), ci = params.get('cierre');
    const url = c ? `/api/comprobantes/${encodeURIComponent(c)}` : ci ? `/api/caja/cierres/${encodeURIComponent(ci)}` : null;
    if (!url) { papel.innerHTML = '<p class="error">No se indicó qué imprimir.</p>'; return; }
    try {
      const res = await fetch(url, { headers: { Authorization: 'Bearer ' + token } });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'No se pudo cargar el documento.');
      if (c) renderComprobante(data.comprobante); else renderCierre(data.cierre);
      if (params.get('auto') === '1') {
        const img = papel.querySelector('img');
        const imprimir = () => setTimeout(() => window.print(), 250);
        if (img && !img.complete) img.addEventListener('load', imprimir, { once: true }); else imprimir();
      }
    } catch (err) {
      papel.innerHTML = `<p class="error">${esc(err.message)}</p>`;
    }
  }
  cargar();
})();
