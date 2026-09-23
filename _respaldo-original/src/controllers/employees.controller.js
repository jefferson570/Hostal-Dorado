/**
 * controllers/employees.controller.js
 * ---------------------------------------------------------------
 * "Control de empleados": el administrador registra la jornada de
 * un colaborador (hora de ingreso, hora de salida y cuántas
 * habitaciones limpió), con observaciones. Las incidencias
 * (averías, quejas) ya tienen su propio módulo — este es solo el
 * registro de jornadas/tareas del personal.
 */
const db = require('../db');
const { newId } = require('../utils/ids');
const realtime = require('../realtime');

const nowISO = () => new Date().toISOString();
const today = () => new Date().toISOString().slice(0, 10);

/** Horas trabajadas a partir de "HH:MM" de ingreso y salida (soporta turnos que cruzan medianoche). */
function horasTrabajadas(ingreso, salida) {
  if (!ingreso || !salida) return null;
  const [h1, m1] = ingreso.split(':').map(Number);
  const [h2, m2] = salida.split(':').map(Number);
  if ([h1, m1, h2, m2].some(n => Number.isNaN(n))) return null;
  let min = (h2 * 60 + m2) - (h1 * 60 + m1);
  if (min < 0) min += 24 * 60; // cruzó la medianoche
  return Math.round((min / 60) * 100) / 100;
}

/** GET /api/employees/logs — últimos 200 registros, más recientes primero. */
function list(req, res) {
  const rows = db.prepare('SELECT * FROM staff_logs ORDER BY fecha DESC, created_at DESC LIMIT 200').all();
  res.json({ logs: rows.map(l => ({ ...l, horas: horasTrabajadas(l.hora_ingreso, l.hora_salida) })) });
}

/** GET /api/employees/summary — total de habitaciones y horas trabajadas por empleado (últimos 30 días). */
function summary(req, res) {
  const rows = db.prepare(`
    SELECT empleado, fecha, hora_ingreso, hora_salida, habitaciones
    FROM staff_logs
    WHERE fecha >= date('now', '-29 days')
  `).all();

  const porEmpleado = {};
  for (const r of rows) {
    const acc = porEmpleado[r.empleado] || (porEmpleado[r.empleado] = { empleado: r.empleado, dias: 0, total_habitaciones: 0, total_horas: 0 });
    acc.dias += 1;
    acc.total_habitaciones += Number(r.habitaciones) || 0;
    acc.total_horas += horasTrabajadas(r.hora_ingreso, r.hora_salida) || 0;
  }
  const resumen = Object.values(porEmpleado)
    .map(r => ({ ...r, total_horas: Math.round(r.total_horas * 100) / 100 }))
    .sort((a, b) => b.total_habitaciones - a.total_habitaciones);

  res.json({ resumen });
}

/** POST /api/employees/logs — solo admin, registra la jornada de un colaborador. */
function create(req, res) {
  const { empleado, fecha, hora_ingreso, hora_salida, habitaciones, notas } = req.body;
  const row = {
    id: newId(),
    empleado: String(empleado).trim(),
    fecha: fecha || today(),
    hora_ingreso: hora_ingreso || null,
    hora_salida: hora_salida || null,
    habitaciones: Math.max(0, parseInt(habitaciones, 10) || 0),
    notas: notas ? String(notas).trim().slice(0, 500) : null,
    registrado_por: req.user.nombre,
    created_at: nowISO(),
  };
  db.prepare(`
    INSERT INTO staff_logs (id, empleado, fecha, hora_ingreso, hora_salida, habitaciones, notas, registrado_por, created_at)
    VALUES (@id, @empleado, @fecha, @hora_ingreso, @hora_salida, @habitaciones, @notas, @registrado_por, @created_at)
  `).run(row);

  realtime.broadcast('staff:changed', { reason: 'create' });
  res.status(201).json({ log: { ...row, horas: horasTrabajadas(row.hora_ingreso, row.hora_salida) } });
}

/** DELETE /api/employees/logs/:id — solo admin, corrige un registro mal ingresado. */
function remove(req, res) {
  const log = db.prepare('SELECT * FROM staff_logs WHERE id = ?').get(req.params.id);
  if (!log) return res.status(404).json({ error: 'Registro no encontrado.' });
  db.prepare('DELETE FROM staff_logs WHERE id = ?').run(log.id);
  realtime.broadcast('staff:changed', { reason: 'delete' });
  res.json({ ok: true });
}

module.exports = { list, summary, create, remove };
