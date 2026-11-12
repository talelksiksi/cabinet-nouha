@echo off
rem Espace cabinet - etat
net session >nul 2>&1 || (powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs" & exit /b)
chcp 65001 >nul
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0outils\gerer.ps1" -Action etat
