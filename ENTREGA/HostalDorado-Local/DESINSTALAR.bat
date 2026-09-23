@echo off
REM Detiene y quita el servicio de Hostal Dorado (los datos NO se borran).
powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process powershell -Verb RunAs -ArgumentList '-NoProfile -ExecutionPolicy Bypass -File ""%~dp0instalacion\desinstalar.ps1""'"
