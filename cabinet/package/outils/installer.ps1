# ═══════════════════════════════════════════
#  Espace cabinet Dr Nouha Ksiksi — installation / mise à jour
#  Lancé par INSTALLER.cmd (droits administrateur). Rien à télécharger : tout est dans ce dossier.
#  Programme : C:\EspaceCabinet\app   Données : C:\EspaceCabinet\data (jamais effacées par une mise à jour)
# ═══════════════════════════════════════════
$ErrorActionPreference = 'Stop'
$Host.UI.RawUI.WindowTitle = 'Espace cabinet - installation'
$Src  = Split-Path -Parent $PSScriptRoot
$Dest = 'C:\EspaceCabinet'
$Task = 'Espace cabinet Nouha'
$Name = 'cabinet-nouha.local'

function Etape($t) { Write-Host ''; Write-Host "▶ $t" -ForegroundColor Cyan }
function Ok($t)    { Write-Host "  ✔ $t" -ForegroundColor Green }
function Info($t)  { Write-Host "  $t" }
function Stop-Install($t) { Write-Host ''; Write-Host "✖ $t" -ForegroundColor Red; Write-Host ''; Read-Host 'Appuyez sur Entrée pour fermer'; exit 1 }

Write-Host '══════════════════════════════════════════════' -ForegroundColor DarkCyan
Write-Host '  Espace cabinet — Dr Nouha Ksiksi' -ForegroundColor White
Write-Host '  Installation sur ce PC (serveur du cabinet)' -ForegroundColor Gray
Write-Host '══════════════════════════════════════════════' -ForegroundColor DarkCyan

# ── Vérifications ──
Etape 'Vérifications'
if (-not [Environment]::Is64BitOperatingSystem) { Stop-Install 'Windows 64 bits requis.' }
if (-not (Test-Path "$Src\node\node.exe") -or -not (Test-Path "$Src\app\server\index.mjs")) { Stop-Install "Dossier incomplet : décompressez tout le fichier ZIP avant de lancer l'installation." }
Get-ChildItem -Path $Src -Recurse -File | Unblock-File -ErrorAction SilentlyContinue
$update = Test-Path "$Dest\app\server\index.mjs"
if ($update) { Info 'Installation existante détectée : mise à jour (les données sont conservées).' }
$existing = Get-ScheduledTask -TaskName $Task -ErrorAction SilentlyContinue
if ($existing) { Stop-ScheduledTask -TaskName $Task -ErrorAction SilentlyContinue; Start-Sleep -Seconds 2 }
Get-Process node -ErrorAction SilentlyContinue | Where-Object { $_.Path -like "$Dest\*" } | Stop-Process -Force -ErrorAction SilentlyContinue
foreach ($port in 443, 80) {
  $c = Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($c) {
    $p = Get-Process -Id $c.OwningProcess -ErrorAction SilentlyContinue
    if ($port -eq 443) { Stop-Install "Le port 443 est déjà utilisé par « $($p.ProcessName) ». Fermez ce programme (ou choisissez un autre PC) puis relancez." }
    else { Info "Remarque : le port 80 est utilisé par « $($p.ProcessName) » : la page d'installation du certificat ne sera pas disponible en http." }
  }
}
Ok 'PC compatible'

# ── Copie des fichiers ──
Etape 'Copie du programme dans C:\EspaceCabinet'
New-Item -ItemType Directory -Force -Path $Dest, "$Dest\data" | Out-Null
foreach ($d in 'app', 'node', 'outils') {
  if (Test-Path "$Dest\$d") { Remove-Item -Recurse -Force "$Dest\$d" }
  Copy-Item -Recurse -Force "$Src\$d" "$Dest\$d"
}
Copy-Item -Force "$Src\*.cmd", "$Src\*.html", "$Src\*.txt" $Dest -ErrorAction SilentlyContinue
# Données : accès réservé aux administrateurs du PC et au service
icacls "$Dest\data" /inheritance:r /grant:r 'SYSTEM:(OI)(CI)F' '*S-1-5-32-544:(OI)(CI)F' | Out-Null
Ok 'Programme copié ; dossier des données protégé'

# ── Démarrage automatique (tâche planifiée, même sans session ouverte) ──
Etape 'Démarrage automatique avec Windows'
$action    = New-ScheduledTaskAction -Execute "$Dest\node\node.exe" -Argument "--no-warnings `"$Dest\app\server\index.mjs`"" -WorkingDirectory "$Dest\app"
$trigger   = New-ScheduledTaskTrigger -AtStartup
$principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
$settings  = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero) -MultipleInstances IgnoreNew
Register-ScheduledTask -TaskName $Task -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Description 'Serveur local de l''Espace cabinet (réseau du cabinet uniquement)' -Force | Out-Null
Ok 'Le serveur démarrera tout seul à chaque allumage du PC'

# ── Pare-feu : réseau local uniquement ──
Etape 'Pare-feu (réseau du cabinet uniquement)'
Get-NetFirewallRule -DisplayName 'Espace cabinet*' -ErrorAction SilentlyContinue | Remove-NetFirewallRule
New-NetFirewallRule -DisplayName 'Espace cabinet (web)' -Direction Inbound -Action Allow -Program "$Dest\node\node.exe" -Protocol TCP -LocalPort 80, 443 -RemoteAddress LocalSubnet -Profile Any | Out-Null
New-NetFirewallRule -DisplayName 'Espace cabinet (nom réseau)' -Direction Inbound -Action Allow -Program "$Dest\node\node.exe" -Protocol UDP -LocalPort 5353 -RemoteAddress LocalSubnet -Profile Any | Out-Null
Ok 'Ouvert uniquement aux appareils du réseau local'

# ── Le PC ne se met pas en veille ; mises à jour Windows hors des heures d'ouverture ──
Etape 'Alimentation et mises à jour Windows'
powercfg /change standby-timeout-ac 0 | Out-Null
powercfg /change hibernate-timeout-ac 0 | Out-Null
$wu = 'HKLM:\SOFTWARE\Microsoft\WindowsUpdate\UX\Settings'
if (-not (Test-Path $wu)) { New-Item -Path $wu -Force | Out-Null }
Set-ItemProperty -Path $wu -Name ActiveHoursStart -Value 7 -Type DWord
Set-ItemProperty -Path $wu -Name ActiveHoursEnd -Value 19 -Type DWord
Ok 'Pas de mise en veille sur secteur ; pas de redémarrage Windows entre 7 h et 19 h'

# ── Nom cabinet-nouha.local sur ce PC lui-même ──
$hosts = "$env:SystemRoot\System32\drivers\etc\hosts"
if (-not (Select-String -Path $hosts -Pattern $Name -Quiet)) { Add-Content -Path $hosts -Value "`r`n127.0.0.1 $Name   # Espace cabinet" -Encoding ASCII }

# ── Lancement ──
Etape 'Démarrage du serveur'
Start-ScheduledTask -TaskName $Task
$ca = "$Dest\data\tls\ca.crt"
for ($i = 0; $i -lt 60; $i++) {
  if ((Test-Path $ca) -and (Get-NetTCPConnection -State Listen -LocalPort 443 -ErrorAction SilentlyContinue)) { break }
  Start-Sleep -Milliseconds 500
}
if (-not (Get-NetTCPConnection -State Listen -LocalPort 443 -ErrorAction SilentlyContinue)) { Stop-Install "Le serveur n'a pas démarré. Voir le journal : $Dest\data\serveur.log" }
Ok 'Serveur en marche'

# ── Certificat du cabinet approuvé sur ce PC ──
Import-Certificate -FilePath $ca -CertStoreLocation Cert:\LocalMachine\Root | Out-Null
Ok 'Connexion sécurisée approuvée sur ce PC'

# ── Raccourci sur le bureau de tous les utilisateurs ──
Set-Content -Path "$env:PUBLIC\Desktop\Espace cabinet.url" -Value "[InternetShortcut]`r`nURL=https://$Name/`r`nIconIndex=0" -Encoding ASCII
Ok 'Raccourci « Espace cabinet » sur le bureau'

# ── Fin ──
$ip = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' -and $_.PrefixOrigin -ne 'WellKnown' } | Select-Object -First 1).IPAddress
Write-Host ''
Write-Host '══════════════════════════════════════════════' -ForegroundColor DarkCyan
Write-Host '  Installation terminée' -ForegroundColor Green
Write-Host '══════════════════════════════════════════════' -ForegroundColor DarkCyan
Write-Host "  Adresse :            https://$Name"
Write-Host "  Adresse IP du PC :   $ip   (à réserver dans la box, voir le guide)"
Write-Host "  Autres appareils :   ouvrir http://$Name/certificat (une fois par appareil)"
if (-not $update) {
  $token = (Get-Content "$Dest\data\secrets.json" -Raw | ConvertFrom-Json).setupToken
  Write-Host ''
  Write-Host "  CODE D'INSTALLATION : $token" -ForegroundColor Yellow
  Write-Host '  (à saisir sur la page qui s''ouvre, pour créer le compte administrateur informatique)'
}
Write-Host ''
Start-Process "https://$Name/"
Read-Host 'Appuyez sur Entrée pour fermer'
