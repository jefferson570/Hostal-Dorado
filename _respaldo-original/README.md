# 🏨 Hostal Dorado — Sistema de Gestión Hotelera

Sistema real de administración para un hostal en Perú: habitaciones, registro de
huéspedes (DNI/Pasaporte/Carné de Extranjería), finanzas e inventario — con
backend propio, base de datos persistente, actualizaciones en tiempo real entre
varios dispositivos y exportación a Excel.

---

## 1. ¿Qué lenguajes y tecnologías usa?

| Capa | Tecnología | Para qué |
|---|---|---|
| Backend (servidor) | **JavaScript (Node.js)** | Ejecuta toda la lógica de negocio, la API y el servidor web |
| Framework del servidor | **Express** | Organiza las rutas HTTP (`/api/...`) y middlewares |
| Base de datos | **SQLite** (vía `better-sqlite3`) | Guarda TODOS los datos en un archivo `.db` real, en disco |
| Tiempo real | **Socket.io** (WebSockets) | Avisa a todos los dispositivos conectados cuando algo cambia |
| Autenticación | **JWT** (`jsonwebtoken`) + **bcrypt** (`bcryptjs`) | Login seguro, contraseñas cifradas, sesiones sin servidor con estado |
| Validación | **express-validator** | Verifica los datos que llegan del formulario antes de guardarlos |
| Seguridad | **express-rate-limit**, **cors** | Evita ataques de fuerza bruta al login, controla quién puede llamar la API |
| Exportación | **ExcelJS** | Genera archivos `.xlsx` reales, abribles en Excel |
| Frontend (lo que ve el usuario) | **HTML + CSS + JavaScript "vanilla"** (sin frameworks como React) | Interfaz del sistema, corre en el navegador |
| Comunicación frontend↔backend | **Fetch API (JSON sobre HTTP)** | El navegador le pide datos al servidor y recibe JSON |

**Por qué esta combinación:** es exactamente el mismo patrón (Node + Express +
base de datos SQL + JWT) que usan miles de sistemas reales en producción. No es
una simulación: es una aplicación **cliente-servidor** de verdad. La única
diferencia entre esto y un sistema "grande" de una cadena hotelera es la escala
(ellos usarían PostgreSQL en vez de SQLite y varios servidores), pero la
arquitectura y el código son del mismo tipo.

---

## 2. Estructura del proyecto (qué archivo va dónde)

```
hostal-dorado-backend/
│
├── server.js                     ← Punto de arranque. "node server.js" empieza aquí.
├── package.json                  ← Lista de dependencias y comandos (npm start, npm run dev)
├── .env.example                  ← Plantilla de variables secretas (cópiala como ".env")
├── .gitignore                    ← Qué NO subir a Git (node_modules, .env, la base de datos)
│
├── data/
│   └── hostal.db                 ← Aquí vive TODA la información (se crea sola al arrancar)
│
├── src/                          ← Todo el backend organizado por responsabilidad
│   ├── config.js                 ← Lee las variables de entorno (puerto, clave JWT, etc.)
│   ├── db.js                     ← Crea las tablas y siembra datos de ejemplo la primera vez
│   ├── realtime.js               ← Envía avisos en tiempo real (Socket.io) a todos los clientes
│   │
│   ├── middleware/
│   │   ├── auth.js               ← Verifica el token de sesión (JWT) y el rol del usuario
│   │   ├── validate.js           ← Traduce errores de validación a mensajes claros
│   │   └── errorHandler.js       ← Atrapa cualquier error inesperado del servidor
│   │
│   ├── controllers/              ← La LÓGICA de cada módulo (qué hacer con cada petición)
│   │   ├── auth.controller.js    ← Login y "quién soy"
│   │   ├── rooms.controller.js   ← Habitaciones, check-in, check-out
│   │   ├── guests.controller.js  ← Búsqueda de huéspedes e historial
│   │   ├── finance.controller.js ← Ingresos, egresos, resumen financiero
│   │   ├── inventory.controller.js ← Productos, ventas, stock
│   │   └── export.controller.js  ← Generar el Excel y el respaldo de la base de datos
│   │
│   ├── routes/                   ← Qué URL dispara qué controlador (el "mapa" de la API)
│   │   ├── auth.routes.js        ← POST /api/auth/login · GET /api/auth/me
│   │   ├── rooms.routes.js       ← GET/POST/PATCH/DELETE /api/rooms...
│   │   ├── guests.routes.js      ← GET /api/guests...
│   │   ├── finance.routes.js     ← GET/POST /api/finance...
│   │   ├── inventory.routes.js   ← GET/POST/PATCH/DELETE /api/inventory...
│   │   └── export.routes.js      ← GET /api/export/reporte · /api/export/backup
│   │
│   └── utils/
│       └── ids.js                ← Genera identificadores únicos (UUID)
│
└── public/                       ← Todo lo que el NAVEGADOR descarga y ejecuta (el frontend)
    ├── index.html                ← La única página HTML de todo el sistema
    ├── css/
    │   └── style.css             ← Todos los estilos (colores, layout, responsivo)
    ├── js/
    │   ├── api.js                ← Función central para hablar con el backend (fetch + token)
    │   └── app.js                ← Toda la lógica de pantallas: login, vistas, formularios
    └── img/
        └── lobby.jpg             ← Foto usada en la pantalla de login
```

**Regla de oro para entenderlo:** `routes/` decide **QUÉ URL** existe,
`controllers/` decide **QUÉ HACER** cuando llega esa URL, y `db.js` decide
**DÓNDE SE GUARDA** todo. El `public/` es un mundo aparte: es lo único que
viaja al navegador de la persona.

---

## 3. Instalar y correr el proyecto en Visual Studio Code

### Requisitos
- Tener instalado **Node.js** (versión 18 o superior). Descárgalo de
  [nodejs.org](https://nodejs.org) si no lo tienes. Verifica con:
  ```bash
  node -v
  ```

### Pasos
1. Descomprime la carpeta `hostal-dorado-backend` donde quieras y ábrela con
   **Archivo → Abrir carpeta…** en VS Code.
2. Abre una terminal integrada (`Ctrl + ñ` o `Terminal → Nueva terminal`).
3. Instala las dependencias (descarga todas las librerías de la tabla de
   arriba dentro de una carpeta `node_modules/`):
   ```bash
   npm install
   ```
4. Crea tu archivo de variables de entorno copiando la plantilla:
   ```bash
   cp .env.example .env
   ```
   (En Windows con PowerShell: `copy .env.example .env`)
5. Arranca el servidor:
   ```bash
   npm start
   ```
   Verás en la terminal:
   ```
   🏨  Hostal Dorado — servidor corriendo en http://localhost:3000
   ```
6. Abre esa dirección en tu navegador: **http://localhost:3000**

La primera vez que arranca, `src/db.js` crea el archivo `data/hostal.db` y lo
llena con dos usuarios y datos de ejemplo:

| Usuario | Contraseña | Rol |
|---|---|---|
| `admin` | `admin123` | Administrador |
| `recepcion` | `recep123` | Recepcionista |

> 💡 Tip para cuando estés programando: usa `npm run dev` en vez de
> `npm start`. Reinicia el servidor solo automáticamente cada vez que guardas
> un archivo (usa la bandera `--watch` de Node).

---

## 4. Cómo funciona por dentro (para tu clase de Ingeniería de Sistemas)

### 4.1 Arquitectura cliente–servidor
```
 [Navegador / celular]  <—— HTTP (JSON) ——>  [Servidor Node.js]  <——>  [hostal.db]
        (public/)              y                    (src/)          (SQLite)
                          WebSocket (tiempo real)
```
El navegador **nunca** toca la base de datos directamente. Todo pasa por la
API (`/api/...`). Esto se llama una arquitectura **REST**: cada recurso
(habitaciones, huéspedes, finanzas, inventario) tiene su propia URL y usa los
verbos HTTP con su significado real:

| Verbo | Significado | Ejemplo en este proyecto |
|---|---|---|
| `GET` | Leer datos | `GET /api/rooms` → lista de habitaciones |
| `POST` | Crear algo nuevo | `POST /api/rooms/:id/checkin` → nueva estancia |
| `PATCH` | Modificar parcialmente | `PATCH /api/rooms/:id` → cambiar estado |
| `DELETE` | Eliminar | `DELETE /api/inventory/:id` → borrar producto |

### 4.2 Autenticación con JWT (JSON Web Token)
1. El usuario envía usuario+contraseña a `POST /api/auth/login`.
2. El servidor compara la contraseña con el **hash** guardado (nunca se
   guarda la contraseña real — ver `bcrypt.hashSync` en `db.js`).
3. Si es correcta, el servidor firma un token con `jsonwebtoken` que contiene
   `{ id, usuario, rol }` y lo devuelve.
4. El navegador guarda ese token en `localStorage` (ver `api.js`) y lo manda
   en cada petición dentro del header `Authorization: Bearer <token>`.
5. `src/middleware/auth.js` verifica la firma en cada petición protegida.

Esto se llama autenticación **"stateless"** (sin estado): el servidor no
necesita recordar quién inició sesión — toda la prueba va dentro del propio
token, firmada con una clave secreta (`JWT_SECRET` en tu `.env`) que solo el
servidor conoce.

### 4.3 Base de datos: el modelo relacional
```
users            rooms              guests
─────            ─────              ──────
id  (PK)         id  (PK)           id  (PK)
username         numero             tipo_documento
password_hash    tipo               numero_documento
role             precio             nombres, apellidos
                 estado             nacionalidad, procedencia...
                    │                    │
                    └──────┐      ┌──────┘
                           ▼      ▼
                          stays (estancias)
                          ──────────────────
                          id (PK)
                          room_id   (FK → rooms)
                          guest_id  (FK → guests)
                          checkin_date, checkout_date
                          nights, price_per_night, total
                          estado ('activa' / 'finalizada')
                              │
                              ▼
                          finance (al hacer checkout se inserta aquí)
                          ─────────────────────────────────────────
                          id, fecha, concepto, tipo, monto, metodo
                          referencia_estancia_id (FK → stays, opcional)

inventory                inventory_movements
─────────                ───────────────────
id, nombre, categoria     id, producto_id (FK)
stock, stock_minimo       tipo ('venta' / 'ajuste')
precio                    cantidad, motivo
```

`PK` = *Primary Key* (llave primaria, identifica única cada fila).
`FK` = *Foreign Key* (llave foránea, apunta a una fila de otra tabla — así
es como una estancia "sabe" a qué habitación y a qué huésped pertenece).

Puedes ver el SQL exacto de cada tabla, comentado línea por línea, en
`src/db.js`.

### 4.4 Por qué el stock y el dinero se calculan en el servidor
En `inventory.controller.js`, la función `sell()` descuenta el stock **y**
registra el ingreso en finanzas dentro de una **transacción** (`db.transaction`).
Una transacción garantiza que ambas cosas pasen juntas o ninguna pase: si el
servidor se cayera justo a la mitad, nunca vas a terminar con "stock
descontado pero sin el ingreso registrado" (eso se llama mantener la
**consistencia** de los datos, uno de los 4 principios ACID de las bases de
datos: Atomicidad, Consistencia, Aislamiento, Durabilidad).

### 4.5 Tiempo real con Socket.io (multidispositivo de verdad)
Cada vez que algo cambia (`server.js` → `src/realtime.js` → controladores),
el servidor emite un evento (`rooms:changed`, `finance:changed`,
`inventory:changed`) a **todos** los navegadores conectados, sin importar si
es el celular de recepción o la laptop del administrador. El frontend
(`app.js`, función `connectRealtime()`) escucha esos eventos y vuelve a pedir
los datos de la pantalla actual. Así, si alguien vende un producto desde el
celular, el dashboard del administrador en otra computadora se actualiza
solo.

---

## 5. ¿Por qué esto ya no pierde datos y funciona en varios dispositivos?

En la primera versión (la de un solo archivo HTML) los datos vivían en el
`localStorage` del navegador: cada dispositivo tenía **su propia copia**, y
borrar el navegador borraba todo.

Ahora los datos viven en **un solo lugar: el servidor**, dentro del archivo
`data/hostal.db`. Cualquier dispositivo que se conecte a ese servidor (por la
misma red Wi-Fi, o por internet si lo publicas) ve y modifica **la misma
información real**. Eso es lo que hace a este sistema "multidispositivo" de
verdad.

### Para usarlo desde el celular de recepción (misma red Wi-Fi)
1. En la computadora donde corre `npm start`, averigua su IP local:
   - Windows: `ipconfig` (busca "Dirección IPv4", ej. `192.168.1.15`)
   - Mac/Linux: `ifconfig` o `ip a`
2. Desde el celular (conectado al mismo Wi-Fi), abre en el navegador:
   `http://192.168.1.15:3000` (cambia la IP por la tuya).

### Para usarlo desde cualquier lugar (internet)
Necesitas subir este mismo código a un servidor con IP pública. Opciones
sencillas y económicas para un proyecto de este tamaño: **Railway**,
**Render** o un VPS barato. El proceso siempre es: subir el código, correr
`npm install && npm start`, y usar un **disco persistente** para que el
archivo `data/hostal.db` no se borre entre despliegues. Si quieres, en tu
siguiente mensaje te preparo los pasos exactos para el proveedor que
prefieras.

### Respaldo de la información
El botón **"Respaldo de base de datos"** (solo administrador) descarga el
archivo `hostal.db` completo — es tu copia de seguridad. Recomendación real de
la industria: automatiza una copia diaria de esa carpeta `data/` (por ejemplo
con una tarea programada) además de los respaldos manuales.

---

## 6. Cumplimiento legal: registro de huéspedes en Perú

El **Reglamento de Establecimientos de Hospedaje** (Perú) exige llevar una
Ficha o Libro de Registro de Huésped. Por eso la tabla `guests` guarda:

- Tipo de documento (**DNI** para peruanos — validado con exactamente 8
  dígitos —, **Pasaporte** o **Carné de Extranjería** para extranjeros)
- Nombres y apellidos completos
- Nacionalidad
- Procedencia y destino
- Teléfono de contacto

Estos datos se piden obligatoriamente en el **check-in** (`rooms.controller.js`,
función `checkin`) y quedan disponibles para consulta y exportación en la
sección **Huéspedes** y en el reporte de Excel.

> Este sistema cubre el **registro** de esos datos. Si tu hostal está
> obligado a reportarlos a Migraciones (obligatorio para huéspedes
> extranjeros), eso es un trámite/integración aparte que no está automatizado
> aquí — puedo ayudarte a añadirlo si lo necesitas.

---

## 7. Exportar todo a Excel

El botón **"⬇ Exportar Excel"** (arriba a la derecha, disponible para ambos
roles) descarga un archivo `.xlsx` con 6 hojas:

1. **Habitaciones** — estado y huésped actual de cada una
2. **Huéspedes** — la ficha completa de cada persona registrada
3. **Estancias** — historial de todos los check-in/check-out
4. **Finanzas** — cada ingreso y egreso, con quién lo registró
5. **Inventario** — stock y valor actual de cada producto
6. **Movimientos de inventario** — auditoría de cada venta o ajuste de stock

Se genera al vuelo con la librería `ExcelJS` (ver `export.controller.js`) —
no es una foto ni una tabla pegada: es un archivo Excel real que puedes
filtrar, ordenar y usar en fórmulas.

---

## 8. Seguridad — qué se hizo y por qué

- **Contraseñas cifradas** con `bcrypt` (nunca se guarda ni se puede leer la
  contraseña real, ni siquiera el propio administrador del sistema).
- **JWT firmado** con una clave secreta que solo el servidor conoce
  (`JWT_SECRET`, en tu `.env` — nunca lo subas a un repositorio público).
- **Límite de intentos de login** (`express-rate-limit`): 10 intentos cada 15
  minutos por IP, para frenar ataques de fuerza bruta.
- **Autorización por rol**: cada ruta sensible (`requireRole('admin')`)
  verifica el rol del token, no solo si hay sesión iniciada.
- **Validación de entrada** (`express-validator`) en cada formulario, para
  que nunca llegue un DNI con letras o un precio negativo a la base de datos.
- **Mensajes de error genéricos en login**: nunca se revela si el usuario
  existe o no, solo "usuario, rol o contraseña incorrectos".

### Antes de usarlo en producción real, cambia esto:
1. Genera una clave `JWT_SECRET` real y larga:
   ```bash
   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
   ```
   y pégala en tu `.env`.
2. Cambia las contraseñas de los usuarios `admin` y `recepcion` (puedes
   crear un pequeño script que actualice `password_hash` en la tabla `users`,
   o pídeme que te agregue una pantalla de "cambiar contraseña").
3. Sirve la aplicación con HTTPS (cualquier proveedor de hosting moderno lo
   da gratis).

---

## 9. Ideas para seguir mejorando (buen material para tu portafolio)

- Pantalla de "cambiar mi contraseña" y gestión de usuarios desde el admin.
- Reportes con gráficos más avanzados (ingresos por tipo de habitación, etc.).
- Reservas a futuro (no solo check-in del mismo día).
- Migrar de SQLite a PostgreSQL si el hostal crece a varias sedes.
- Notificaciones (por correo o WhatsApp) cuando el stock de un producto baja
  del mínimo.
