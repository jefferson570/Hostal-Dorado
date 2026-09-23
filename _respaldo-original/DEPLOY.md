# Subir Hostal Dorado a internet, gratis

## La realidad honesta primero

Este sistema guarda todo en un archivo local (`data/hostal.db`, SQLite).
Casi ninguna plataforma 100% gratuita mantiene ese archivo si el
servidor se reinicia o si vuelves a subir el código — el disco "gratis"
de la mayoría de estos servicios se borra en esos momentos. Ninguna
opción gratuita real resuelve esto del todo, así que abajo van dos
caminos honestos, no una promesa de que "todo quedará perfecto gratis".

## Opción recomendada: Render (gratis, sin tarjeta)

Es la más simple y no pide tarjeta de crédito. Contras a aceptar:
- El servidor "duerme" tras 15 minutos sin visitas — la primera persona
  que entra después espera ~30-60 segundos mientras despierta.
- **El archivo de la base de datos se reinicia cada vez que subes una
  actualización de código** (y ocasionalmente por mantenimiento de
  Render). Por eso configuramos el respaldo automático a Google Sheets
  (ver `GOOGLE_SHEETS_SETUP.md`) — así, aunque el archivo local se
  reinicie, el historial de huéspedes y finanzas no se pierde. Antes de
  cada actualización de código, además, descarga el respaldo de la
  base de datos desde el panel (botón "Respaldo de base de datos").

**Pasos:**
1. Sube tu proyecto a un repositorio de GitHub (si no lo has hecho:
   crea un repo en github.com, y desde la carpeta del proyecto:
   `git init`, `git add .`, `git commit -m "Hostal Dorado"`, y sigue las
   instrucciones de GitHub para conectar y subir el repo).
2. Ve a [render.com](https://render.com) → crea cuenta gratis (puedes
   entrar con GitHub directamente).
3. **New → Web Service** → conecta tu repositorio.
4. Configuración:
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Instance Type:** Free
5. En la pestaña **Environment**, agrega las variables (las mismas de
   tu `.env`, sin comillas):
   - `NODE_ENV=production`
   - `JWT_SECRET` → genera una nueva y real (no la de ejemplo): en tu
     computadora corre `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`
     y pega el resultado.
   - `JWT_EXPIRES_IN=8h`
   - `DB_PATH=./data/hostal.db`
   - `CORS_ORIGINS` → la URL que Render te va a asignar, algo como
     `https://hostal-dorado.onrender.com` (la ves después del primer
     deploy y la actualizas aquí).
   - Si configuraste Google Sheets: `GOOGLE_SHEETS_ENABLED=true`,
     `GOOGLE_SHEET_ID=...`, y sube el archivo `.json` como **Secret
     File** de Render (pestaña "Secret Files", ruta
     `/etc/secrets/google-service-account.json`) y pon
     `GOOGLE_SERVICE_ACCOUNT_KEY_PATH=/etc/secrets/google-service-account.json`.
6. Clic en **Create Web Service**. En unos minutos tendrás tu URL
   pública con HTTPS automático — esa es la que le compartes a tu
   cliente. No hay costo de dominio: Render te da gratis un subdominio
   `algo.onrender.com`.

## Opción alternativa: Fly.io (con disco persistente real)

Si en algún momento la base de datos reiniciándose te resulta
demasiado molesto, Fly.io sí ofrece un volumen persistente de verdad en
su capa gratuita (así el archivo `.db` sobrevive a reinicios y
despliegues), pero **pide una tarjeta para verificar la cuenta**
(no te cobra mientras te mantengas dentro de lo gratuito, pero la
piden). Si te sirve esa condición, dime y te armo la guía paso a paso
para esa migración (usa un archivo `fly.toml` y el comando `flyctl`).

## Un dominio propio (tuhostal.com) más adelante

Eso sí tiene costo siempre (~10-15 USD/año en cualquier registrador:
Namecheap, GoDaddy, etc.) — no hay forma 100% gratuita de tener un
".com" propio. El subdominio gratuito de Render (`tuhostal.onrender.com`)
es perfectamente funcional y profesional para empezar a mostrarle el
sistema a tu cliente sin gastar nada; el dominio propio es un paso que
puedes dar después, cuando el cliente ya esté usando el sistema y
decida invertir en su marca.
