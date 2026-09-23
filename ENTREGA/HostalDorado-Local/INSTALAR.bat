@echo off
REM Instala Hostal Dorado en esta PC (pide permisos de administrador).
powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process powershell -Verb RunAs -ArgumentList '-NoProfile -ExecutionPolicy Bypass -File ""%~dp0instalacion\instalar.ps1""'"
