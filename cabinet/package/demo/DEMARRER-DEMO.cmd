@echo off
rem Espace cabinet - demonstration : cabinet fictif recree a chaque lancement. Fermer la fenetre pour arreter.
chcp 65001 >nul
title Espace cabinet - DEMONSTRATION (fermer cette fenetre pour arreter)
cd /d "%~dp0"
"%~dp0node\node.exe" --no-warnings "%~dp0app\tools\demo.mjs" --revue
echo.
echo La demonstration est arretee. Appuyez sur une touche pour fermer.
pause >nul
