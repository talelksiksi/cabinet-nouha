@echo off
rem Espace cabinet - demonstration sur ce PC (donnees fictives, regenerees a chaque lancement)
cd /d "%~dp0"
title Espace cabinet - demonstration
chcp 65001 >nul
set NODE=node
if exist "C:\Program Files\nodejs\node.exe" set NODE="C:\Program Files\nodejs\node.exe"
%NODE% --no-warnings tools\demo.mjs
pause
