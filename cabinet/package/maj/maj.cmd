@echo off
rem Espace cabinet - mise a jour (lance par l'executable de mise a jour)
chcp 65001 >nul
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0mettre-a-jour.ps1" -Payload "%~dp0payload.zip"
