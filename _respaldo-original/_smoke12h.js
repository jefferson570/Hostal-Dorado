// Smoke test de la feature 12 h sobre el server :3101 (server ya corriendo).
const BASE = 'http://localhost:3101';
const pedir = async (path, opts = {}) => {
  const res = await fetch(BASE + path, {
    headers: { ...(opts.token ? { Authorization: 'Bearer ' + opts.token } : {}), ...(opts.body ? { 'Content-Type': 'application/json' } : {}) },
    method: opts.method || 'GET',
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
};
const asert = (cond, msg) => { if (!cond) { console.log('❌ FALLO: ' + msg); process.exitCode = 1; } else console.log('✔ ' + msg); };

(async () => {
  const login = await pedir('/api/auth/login', { method: 'POST', body: { username: 'admin', password: 'admin123', role: 'admin' } });
  asert(login.status === 200, 'login admin');
  const token = login.data.token;

  const FECHA = '2026-09-25', HORA = 10;
  const disp = await pedir(`/api/public/rooms-availability?fecha=${FECHA}&hora=${HORA}`);
  asert(disp.status === 200, 'availability fecha+hora');
  const doble = disp.data.habitaciones.find(h => h.tipo === 'Doble');
  asert(doble && doble.disponibles === 3, `Doble disponible 3 (base): ${JSON.stringify(doble)}`);

  const bad = await pedir('/api/public/rooms-availability?hora=99');
  asert(bad.status === 400, '400 hora fuera de rango');

  const post = async cod => pedir('/api/public/reservations', { method: 'POST', body: { tipo_habitacion: 'Doble', checkin: FECHA, hora_ingreso: HORA, nombre: 'Smoke ' + cod, telefono: '999111222' } });
  const a = await post('A');
  asert(a.status === 201 && a.data.codigo && a.data.horas === 12 && a.data.inicio && a.data.fin, `POST A 201 (codigo ${a.data.codigo})`);
  const b = await post('B');
  asert(b.status === 201, 'POST B 201');

  const disp2 = await pedir(`/api/public/rooms-availability?fecha=${FECHA}&hora=${HORA}`);
  asert(disp2.data.habitaciones.find(h => h.tipo === 'Doble').disponibles === 1, 'Doble baja a 1 con 2 pendientes');

  async function listarPorCodigo(cod) {
    const l = await pedir('/api/reservations', { token });
    return l.data.reservations.find(x => x.id.slice(0, 6).toUpperCase() === cod) || null;
  }
  const ra = await listarPorCodigo(a.data.codigo);
  asert(!!ra, 'reserva A aparece en el listado con inicio/fin/hora');
  asert(ra.inicio && ra.fin && ra.hora_ingreso === HORA, 'listado trae inicio/fin/hora_ingreso');

  const conf2 = await pedir(`/api/reservations/${ra.id}`, { token, method: 'PATCH', body: { estado: 'confirmada' } });
  asert(conf2.status === 200, 'confirmar A 200');
  asert(conf2.data.room && conf2.data.room.numero === '103', `confirma y asigna Hab. 103 (Doble libre más cercana): ${conf2.data.room && conf2.data.room.numero}`);

  const disp3 = await pedir(`/api/public/rooms-availability?fecha=${FECHA}&hora=${HORA}`);
  asert(disp3.data.habitaciones.find(h => h.tipo === 'Doble').disponibles === 1, 'Doble 1: 103 bloqueada por confirmada, 1 pendiente');

  // Hora no solapada (22:00 no toca la ventana 10:00→22:00)
  const disp4 = await pedir(`/api/public/rooms-availability?fecha=${FECHA}&hora=22`);
  asert(disp4.data.habitaciones.find(h => h.tipo === 'Doble').disponibles === 2, 'Doble 22:00 ya no cuenta la ventana de 10:00 → 2 libres');

  const c = await post('C');
  asert(c.status === 201, 'POST C 201 (pendiente #3, llega a 0)');
  const d = await post('D');
  asert(d.status === 409, 'POST D 409 (agotado)');

  // Segundo confirmar no debe dar una habitación ya bloqueada en la misma ventana
  const rb = await listarPorCodigo(b.data.codigo);
  const confB = await pedir(`/api/reservations/${rb.id}`, { token, method: 'PATCH', body: { estado: 'confirmada' } });
  asert(confB.status === 200 && confB.data.room && confB.data.room.numero === '203', `B confirma Hab. 203 (103 ocupada por ventana): ${confB.data.room && confB.data.room.numero}`);

  // Bloqueo visible en /rooms (banderas de reserva)
  const rooms = await pedir('/api/rooms', { token });
  const r103 = rooms.data.rooms.find(r => r.numero === '103');
  asert(r103 && r103.reserva_fin && r103.reserva_nombre === 'Smoke A', `rooms: 103 tiene reserva_fin + nombre (${r103 && r103.reserva_nombre})`);

  // Liberación manual: cambio de estado → el bloqueo deja de reportarse
  await pedir(`/api/rooms/${r103.id}`, { token, method: 'PATCH', body: { estado: 'mantenimiento' } });
  const rooms2 = await pedir('/api/rooms', { token });
  const r103b = rooms2.data.rooms.find(r => r.numero === '103');
  asert(!r103b.reserva_fin, 'liberación manual: 103 en mantenimiento ya no reporta reserva');

  // Cronograma: reserva sale con numero + inicio/fin ISO
  const sched = await pedir('/api/schedule?from=2026-09-21', { token });
  asert(sched.data.reservas.some(r => r.codigo === a.data.codigo && r.numero === '103' && r.inicio.includes('T10:00')), 'schedule incluye A con numero 103 e inicio T10:00');
  asert(sched.data.reservas.some(r => r.codigo === b.data.codigo && r.numero === '203'), 'schedule incluye B con numero 203');

  // Schedule sin token → 401
  const s401 = await pedir('/api/schedule?from=2026-09-21');
  asert(s401.status === 401, 'schedule sin token → 401');

  // Limpieza
  const limpiar = async (id, estado) => pedir(`/api/reservations/${id}`, { token, method: 'PATCH', body: { estado } });
  await limpiar(ra.id, 'cancelada');
  asert(true, 'limpieza A cancelada');
  await limpiar(rb.id, 'cancelada');
  const rc = await listarPorCodigo(c.data.codigo);
  await limpiar(rc.id, 'cancelada');
  await pedir(`/api/rooms/${r103.id}`, { token, method: 'PATCH', body: { estado: 'libre' } });
  asert(true, 'limpieza habitación 103 restaurada');

  console.log(process.exitCode ? 'SMOKE CON ERRORES' : 'SMOKE 12h COMPLETO ✔');
})().catch(e => { console.error('ERROR EJECUCIÓN: ' + e.message); process.exit(1); });