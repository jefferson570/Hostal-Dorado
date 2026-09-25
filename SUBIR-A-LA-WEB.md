# Subir Hostal Dorado a internet (Render)

Con esta versión el sistema queda en una dirección web con HTTPS, por ejemplo
`https://hostal-dorado.onrender.com`, y se puede usar desde cualquier lugar:
el panel del personal y el sitio público donde los clientes hacen pre-reservas.

## Costo (importante)

El sistema guarda todo en un archivo de base de datos, así que necesita un
**disco permanente**. El plan gratis de Render borra ese disco en cada
reinicio o actualización: se perderían huéspedes, caja e inventario. Por eso
`render.yaml` usa el plan **Starter (~7 USD/mes) + disco de 1 GB** (centavos).

## Paso 1 — Subir el código a GitHub

1. Crea una cuenta en https://github.com y un repositorio **privado** vacío
   llamado `hostal-dorado` (sin README ni .gitignore).
2. Esta carpeta ya viene preparada como repositorio. Abre una terminal aquí y
   ejecuta (cambia `TU-USUARIO` por tu usuario de GitHub):

   ```bash
   git remote add origin https://github.com/TU-USUARIO/hostal-dorado.git
   git push -u origin main
   ```

   GitHub te pedirá iniciar sesión la primera vez.

## Paso 2 — Crear el servicio en Render

1. Entra a https://render.com e inicia sesión con tu cuenta de GitHub.
2. **New +** → **Blueprint** → elige el repositorio `hostal-dorado`.
3. Render lee `render.yaml` y configura todo solo: plan, disco permanente,
   modo producción, hora de Perú, clave de seguridad y contraseñas iniciales.
4. Agrega tu tarjeta cuando lo pida (plan Starter) y confirma.
5. Espera unos minutos hasta que diga **Live**.

## Paso 3 — Primer ingreso

- Sitio para clientes: `https://TU-SERVICIO.onrender.com`
- Panel del personal: `https://TU-SERVICIO.onrender.com/panel`
- Pon la URL real en la variable `CORS_ORIGINS` de Render (p. ej.
  `https://TU-SERVICIO.onrender.com`), y si usas dominio propio agrégalo también.
- Las contraseñas iniciales **no son** `admin123`: Render las generó al azar.
  Las ves en tu servicio → pestaña **Environment** → `ADMIN_PASSWORD` y
  `RECEPCION_PASSWORD`. Entra con `admin` / `recepcion` y cámbialas en
  **Configuración**.

## Actualizar el sistema más adelante

```bash
git add .
git commit -m "Descripción del cambio"
git push
```

Render publica la nueva versión solo en 1–2 minutos. Los datos se conservan
porque viven en el disco permanente (`/var/data`).

## Dominio propio (opcional)

Si el cliente quiere `www.hostaldorado.pe`: cómpralo (≈10–40 USD/año) y en
Render → **Settings → Custom Domains** agrega el dominio y copia los registros
DNS que te indique. El HTTPS es gratis y automático.

## Respaldos

- Botón **"Respaldo de base de datos"** del panel (solo administrador):
  descarga una copia completa. Hazlo al menos una vez por semana.
- El servidor además guarda un respaldo diario automático en
  `/var/data/respaldos` (últimos 30 días, ya configurado en `render.yaml`).
- Opcional: respaldo en vivo a Google Sheets (ver `GOOGLE_SHEETS_SETUP.md`).
