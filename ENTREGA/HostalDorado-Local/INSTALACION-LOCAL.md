# Instalar Hostal Dorado en la PC de recepción (sin internet)

El sistema queda funcionando como un servicio de Windows: arranca solo al
encender la PC, se levanta solo si se cae y **los datos nunca se borran**
(quedan en la carpeta `data`, con un respaldo automático por día).

## Instalación (una sola vez)

1. Instala **Node.js LTS** desde https://nodejs.org (siguiente, siguiente…).
2. Copia la carpeta del sistema a `C:\HostalDorado` (sin `node_modules` ni `data`).
3. Clic derecho en **`INSTALAR.bat`** → **Ejecutar como administrador**.
4. Al terminar se abre el navegador y queda un acceso directo
   **"Hostal Dorado"** en el escritorio.
5. Entra con `admin` / `admin123` y **cambia la contraseña** en Configuración.

## Uso diario

- En la PC de recepción: acceso directo del escritorio o http://localhost:3000
- Desde celulares o tablets **conectados al mismo Wi-Fi**: la dirección
  `http://192.168.x.x:3000` que mostró el instalador.
- No hay que abrir nada ni dejar ventanas abiertas: el sistema ya está corriendo.

## Respaldos

- Automáticos: `C:\HostalDorado\data\respaldos\` (uno por día, últimos 30 días).
- Manual: botón **"Respaldo de base de datos"** del panel (solo administrador).
- Recomendado: copiar esa carpeta a un USB o a Google Drive cada semana, o
  cambiar `BACKUP_DIR` en el archivo `.env` a una carpeta de Google Drive/OneDrive.

## Restaurar un respaldo

1. Ejecuta `DESINSTALAR.bat` como administrador (detiene el sistema, no borra datos).
2. Reemplaza `data\hostal.db` por el respaldo elegido (renómbralo a `hostal.db`)
   y borra `data\hostal.db-wal` y `data\hostal.db-shm` si existen.
3. Ejecuta `INSTALAR.bat` como administrador otra vez.

## Actualizar el sistema

Reemplaza los archivos del programa **sin tocar** la carpeta `data` ni el
archivo `.env`, y vuelve a ejecutar `INSTALAR.bat` como administrador.

## Problemas

- Registro de errores: `data\servidor.log`.
- Si el celular no conecta: verifica que esté en el mismo Wi-Fi y que la red
  de Windows esté marcada como **Privada**.
