@echo off
rem Supprime la demonstration de ce PC (dossier et raccourci du bureau). Aucune donnee reelle n'est concernee.
echo Suppression de la demonstration Espace cabinet...
powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | Where-Object { $_.ExecutablePath -like '%LOCALAPPDATA%\EspaceCabinet-Demo\*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }; Remove-Item -Force -ErrorAction SilentlyContinue (Join-Path ([Environment]::GetFolderPath('Desktop')) 'Espace cabinet (d*mo).lnk'); Remove-Item -Force -ErrorAction SilentlyContinue (Join-Path ([Environment]::GetFolderPath('Desktop')) 'Guide de la d*mo Espace cabinet.lnk')"
echo Demonstration supprimee.
cd /d "%TEMP%"
start "" /min cmd /c "timeout /t 2 /nobreak >nul & rmdir /s /q "%LOCALAPPDATA%\EspaceCabinet-Demo""
