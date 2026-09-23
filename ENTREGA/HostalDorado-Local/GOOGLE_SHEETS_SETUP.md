# Respaldo automático en Google Sheets — guía paso a paso

Esto hace que cada huésped que registres (check-in) y cada movimiento de
dinero (ingreso/egreso/venta) se agregue automáticamente como una fila
nueva en una Hoja de cálculo de Google, como respaldo en vivo fuera del
servidor. Es un paso adicional al botón "Exportar Excel" que ya existe
(ese sigue funcionando igual).

Es un proceso de una sola vez, ~10 minutos. Ninguna parte de esto la
puede hacer otra persona por ti porque requiere tu propia cuenta de
Google — pero es gratis, sin límites relevantes para un hostal.

## 1. Crea la hoja de cálculo

1. Ve a [sheets.google.com](https://sheets.google.com) y crea una hoja
   nueva. Ponle de nombre, por ejemplo, **"Hostal Dorado — Respaldo"**.
2. Dentro, crea dos pestañas (clic derecho en la pestaña de abajo → "Cambiar nombre"):
   - `Huéspedes`
   - `Finanzas`
3. En la fila 1 de `Huéspedes`, escribe estos encabezados (uno por celda):
   `Tipo doc | N° doc | Nombres | Apellidos | Nacionalidad | Procedencia | Destino | Teléfono | Habitación | Check-in | Noches | Precio/noche | Registrado`
4. En la fila 1 de `Finanzas`:
   `Fecha | Concepto | Tipo | Monto | Método | Registrado`
5. Copia el **ID de la hoja** desde la URL del navegador. Por ejemplo, si
   la URL es `https://docs.google.com/spreadsheets/d/1AbCdEfGhIjKlMnOp/edit`,
   el ID es `1AbCdEfGhIjKlMnOp`.

## 2. Crea la cuenta de servicio (la "llave" que usa el servidor)

1. Ve a [console.cloud.google.com](https://console.cloud.google.com) e
   inicia sesión con tu cuenta de Google (la misma o cualquier otra).
2. Arriba, crea un proyecto nuevo (nombre libre, ej. "hostal-dorado").
3. Busca **"Google Sheets API"** en la barra de búsqueda y haz clic en
   **"Habilitar"**.
4. En el menú lateral: **APIs y servicios → Credenciales → Crear
   credenciales → Cuenta de servicio**.
5. Ponle un nombre (ej. "hostal-dorado-backup") y termina el asistente
   (los permisos de rol se pueden dejar en blanco).
6. Entra a la cuenta de servicio que creaste → pestaña **"Claves"** →
   **Agregar clave → Crear clave nueva → JSON**. Se descargará un
   archivo `.json` — este es tu secreto, nunca lo compartas ni lo subas
   a GitHub.
7. Copia el **email de la cuenta de servicio** (se ve como
   `hostal-dorado-backup@tu-proyecto.iam.gserviceaccount.com`).

## 3. Comparte la hoja con la cuenta de servicio

1. Vuelve a tu hoja de cálculo → botón **"Compartir"**.
2. Pega el email de la cuenta de servicio (paso 2.7) y dale permiso de
   **Editor**. Sin este paso, el servidor no podrá escribir filas.

## 4. Configura el proyecto

1. Copia el archivo `.json` que descargaste a la carpeta del proyecto,
   por ejemplo como `google-service-account.json` (ya está en
   `.gitignore`, no se sube por accidente a ningún repositorio).
2. En tu archivo `.env`, agrega/edita:
   ```
   GOOGLE_SHEETS_ENABLED=true
   GOOGLE_SERVICE_ACCOUNT_KEY_PATH=./google-service-account.json
   GOOGLE_SHEET_ID=1AbCdEfGhIjKlMnOp
   ```
3. Reinicia el servidor (`npm start`). En la consola debería aparecer:
   `✔ Respaldo automático a Google Sheets activado.`
4. Haz un check-in de prueba y revisa que aparezca la fila en la hoja.

## Notas importantes

- Si algo falla (credenciales mal puestas, sin internet, hoja no
  compartida), el sistema **sigue funcionando normal** — el respaldo a
  Sheets nunca bloquea ni retrasa un check-in, una venta o un cobro.
  Solo verás una advertencia en la consola del servidor.
- Si despliegas en un servicio en la nube (Render, etc.), sube el
  archivo `.json` como variable de entorno o como "Secret File" del
  proveedor en vez de subirlo al repositorio — cada plataforma tiene su
  propia forma de hacerlo, pregúntame cuando llegues a ese paso.
- Esto es un respaldo adicional, no el respaldo principal: la fuente de
  verdad del sistema sigue siendo la base de datos SQLite. Sigue usando
  también "Exportar Excel" y "Respaldo de base de datos" desde el panel.
