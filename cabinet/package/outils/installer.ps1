# ═══════════════════════════════════════════
#  Espace cabinet Dr Nouha Ksiksi — installation / mise à jour
#  Lancé par INSTALLER.cmd (droits administrateur). Rien à télécharger : tout est dans ce dossier.
#  Paquet « Staff » : PC du cabinet.  Paquet « Owner » : portable du Dr Nouha (-Portable).
#  Programme : C:\EspaceCabinet\app   Données : C:\EspaceCabinet\data (jamais effacées par une mise à jour)
#  -Portable : ordinateur portable du Dr Nouha (copie synchronisée, accessible uniquement sur le portable lui-même)
# ═══════════════════════════════════════════
param([switch]$Portable)
$ErrorActionPreference = 'Stop'
$Host.UI.RawUI.WindowTitle = 'Espace cabinet - installation'
$Src  = Split-Path -Parent $PSScriptRoot
$Dest = 'C:\EspaceCabinet'
$Task = 'Espace cabinet Nouha'
$Name = 'cabinet-nouha.local'
$Port = 3475   # portable : http://localhost:3475
$Icon = "$Dest\app\public\favicon.ico"

function Etape($t) { Write-Host ''; Write-Host "▶ $t" -ForegroundColor Cyan }
function Ok($t)    { Write-Host "  ✔ $t" -ForegroundColor Green }
function Info($t)  { Write-Host "  $t" }
function Stop-Install($t) { Write-Host ''; Write-Host "✖ $t" -ForegroundColor Red; Write-Host ''; Read-Host 'Appuyez sur Entrée pour fermer'; exit 1 }

Write-Host '══════════════════════════════════════════════' -ForegroundColor DarkCyan
Write-Host '  Espace cabinet — Dr Nouha Ksiksi' -ForegroundColor White
if ($Portable) { Write-Host '  Installation sur le PORTABLE du Dr Nouha' -ForegroundColor Gray } else { Write-Host '  Installation sur ce PC (serveur du cabinet)' -ForegroundColor Gray }
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
$ports = if ($Portable) { @($Port) } else { @(443, 80) }
foreach ($port in $ports) {
  $c = Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($c) {
    $p = Get-Process -Id $c.OwningProcess -ErrorAction SilentlyContinue
    if ($port -ne 80) { Stop-Install "Le port $port est déjà utilisé par « $($p.ProcessName) ». Fermez ce programme puis relancez." }
    else { Info "Remarque : le port 80 est utilisé par « $($p.ProcessName) » : la page d'installation du certificat ne sera pas disponible en http." }
  }
}
$cfgFile = "$Dest\data\config.json"
if ($update -and (Test-Path $cfgFile)) {
  $wasPortable = (Get-Content $cfgFile -Raw | ConvertFrom-Json).role -eq 'nomade'
  if ($wasPortable -ne [bool]$Portable) { Stop-Install "Ce PC est déjà installé comme $(if ($wasPortable) { 'PORTABLE du Dr Nouha (utilisez le paquet Install-Package-Owner)' } else { 'PC DU CABINET (utilisez le paquet Install-Package-Staff)' })." }
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
if ($Portable) { Set-Content -Path $cfgFile -Value ('{ "role": "nomade", "plainPort": ' + $Port + ' }') -Encoding ASCII }
Ok 'Programme copié ; dossier des données protégé'

if (-not $Portable) {
  # ── Comptes protégés : Dr Nouha et administrateur informatique, créés d'avance avec un code d'activation ──
  Etape 'Comptes du Dr Nouha et de l''administrateur informatique'
  $codes = & "$Dest\node\node.exe" --no-warnings "$Dest\app\tools\comptes.mjs" init 2>&1
  if ($LASTEXITCODE -ne 0) { $codes | ForEach-Object { Write-Host $_ }; Stop-Install 'Création des comptes impossible.' }
  Ok 'Comptes prêts (identifiants : nouha et talel)'
}

# ── Démarrage automatique (tâche planifiée, même sans session ouverte) ──
Etape 'Démarrage automatique avec Windows'
$action    = New-ScheduledTaskAction -Execute "$Dest\node\node.exe" -Argument "--no-warnings `"$Dest\app\server\index.mjs`"" -WorkingDirectory "$Dest\app"
$trigger   = New-ScheduledTaskTrigger -AtStartup
$principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
$settings  = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero) -MultipleInstances IgnoreNew
Register-ScheduledTask -TaskName $Task -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Description 'Serveur local de l''Espace cabinet (réseau du cabinet uniquement)' -Force | Out-Null
Ok 'Le serveur démarrera tout seul à chaque allumage du PC'

Get-NetFirewallRule -DisplayName 'Espace cabinet*' -ErrorAction SilentlyContinue | Remove-NetFirewallRule
if ($Portable) {
  # ── Portable : rien d'ouvert vers l'extérieur ; seule la réponse « où est le PC du cabinet ? » est acceptée ──
  Etape 'Pare-feu (portable : aucune ouverture, sauf la recherche du PC du cabinet)'
  New-NetFirewallRule -DisplayName 'Espace cabinet (recherche du cabinet)' -Direction Inbound -Action Allow -Program "$Dest\node\node.exe" -Protocol UDP -LocalPort 5353 -RemoteAddress LocalSubnet -Profile Any | Out-Null
  Ok 'L''application n''est accessible que sur ce portable'
} else {
  # ── Pare-feu : réseau local uniquement ──
  Etape 'Pare-feu (réseau du cabinet uniquement)'
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
}

# ── Lancement ──
Etape 'Démarrage du serveur'
Start-ScheduledTask -TaskName $Task
$listen = if ($Portable) { $Port } else { 443 }
$ca = "$Dest\data\tls\ca.crt"
for ($i = 0; $i -lt 60; $i++) {
  if ((Get-NetTCPConnection -State Listen -LocalPort $listen -ErrorAction SilentlyContinue) -and ($Portable -or (Test-Path $ca))) { break }
  Start-Sleep -Milliseconds 500
}
if (-not (Get-NetTCPConnection -State Listen -LocalPort $listen -ErrorAction SilentlyContinue)) { Stop-Install "Le serveur n'a pas démarré. Voir le journal : $Dest\data\serveur.log" }
Ok 'Serveur en marche'

if (-not $Portable) {
  # ── Certificat du cabinet approuvé sur ce PC ──
  Import-Certificate -FilePath $ca -CertStoreLocation Cert:\LocalMachine\Root | Out-Null
  Ok 'Connexion sécurisée approuvée sur ce PC'
}

# ── Raccourci sur le bureau de tous les utilisateurs, avec l'icône du cabinet ──
$lnkName = if ($Portable) { 'Espace cabinet (portable)' } else { 'Espace cabinet' }
$url = if ($Portable) { "http://localhost:$Port/" } else { "https://$Name/" }
Remove-Item "$env:PUBLIC\Desktop\Espace cabinet*.url" -ErrorAction SilentlyContinue
Set-Content -Path "$env:PUBLIC\Desktop\$lnkName.url" -Value "[InternetShortcut]`r`nURL=$url`r`nIconFile=$Icon`r`nIconIndex=0" -Encoding ASCII
Ok "Raccourci « $lnkName » sur le bureau"

# ── Fin ──
$ip = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' -and $_.PrefixOrigin -ne 'WellKnown' } | Select-Object -First 1).IPAddress
Write-Host ''
Write-Host '══════════════════════════════════════════════' -ForegroundColor DarkCyan
Write-Host '  Installation terminée' -ForegroundColor Green
Write-Host '══════════════════════════════════════════════' -ForegroundColor DarkCyan
if ($Portable) {
  Write-Host "  Adresse sur ce portable : http://localhost:$Port"
  if (-not $update) {
    Write-Host ''
    Write-Host '  À FAIRE MAINTENANT, AU CABINET (portable sur le Wi-Fi du cabinet) :' -ForegroundColor Yellow
    Write-Host '  1. Sur le PC du cabinet : Sauvegardes & système → « Associer un portable » → un code s''affiche.'
    Write-Host '  2. Sur la page qui s''ouvre ici : saisir ce code. Les dossiers sont copiés sur le portable.'
  }
  Write-Host ''
  Start-Process $url
  Read-Host 'Appuyez sur Entrée pour fermer'
  exit 0
}
Write-Host "  Adresse :            https://$Name"
Write-Host "  Adresse IP du PC :   $ip   (à réserver dans la box, voir le guide)"
Write-Host "  Autres appareils :   ouvrir http://$Name/certificat (une fois par appareil)"
if ($codes -match 'code : ') {
Write-Host ''
$codes | ForEach-Object { if ($_ -match 'code : ') { Write-Host $_ -ForegroundColor Yellow } else { Write-Host $_ } }
Write-Host ''
Write-Host '  Recopiez ces codes maintenant (ils ne sont enregistrés nulle part) ; chacun active SON compte' -ForegroundColor Yellow
Write-Host '  sur la page qui s''ouvre : « Première connexion (code d''activation ou d''invitation) ».' -ForegroundColor Yellow
Write-Host '  Code perdu ou expiré avant activation : relancer INSTALLER.cmd (nouveaux codes, rien d''autre ne change).'
}
Write-Host ''
Start-Process "https://$Name/"
Read-Host 'Appuyez sur Entrée pour fermer'
