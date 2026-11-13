# ═══════════════════════════════════════════
#  Espace cabinet — mise à jour automatique (lancée par Mise-a-jour-EspaceCabinet-<version>.exe)
#  Même fichier pour le PC du cabinet et pour le portable du Dr Nouha : le rôle de ce PC est détecté.
#  1. vérifie la version installée (rien à faire si elle est déjà à jour)
#  2. demande les droits administrateur
#  3. arrête le serveur, met de côté la base et l'ancienne version
#  4. remplace le programme (les données, comptes, réglages, sauvegardes ne sont jamais touchés)
#  5. redémarre et vérifie ; en cas d'échec, remet automatiquement l'ancienne version et la base
#  -Test : essai sur un dossier quelconque, sans tâche Windows ni droits administrateur (développement)
# ═══════════════════════════════════════════
param([string]$Payload = "$PSScriptRoot\payload.zip", [string]$Dest = 'C:\EspaceCabinet', [switch]$Test, [switch]$Elevated)
$ErrorActionPreference = 'Stop'
$Host.UI.RawUI.WindowTitle = 'Espace cabinet - mise à jour'
$Task = 'Espace cabinet Nouha'
function Etape($t) { Write-Host ''; Write-Host "▶ $t" -ForegroundColor Cyan }
function Ok($t)    { Write-Host "  ✔ $t" -ForegroundColor Green }
function Info($t)  { Write-Host "  $t" }
function Fin($code, $t, $color = 'Green') {
  Write-Host ''; Write-Host $t -ForegroundColor $color; Write-Host ''
  if (-not $Test) { Read-Host 'Appuyez sur Entrée pour fermer' | Out-Null }
  exit $code
}
function VersionOf($text) { if ($text) { ($text -split '\s+')[0].Trim() } else { '' } }

if (-not $Elevated) {
  Write-Host '══════════════════════════════════════════════' -ForegroundColor DarkCyan
  Write-Host '  Espace cabinet — mise à jour' -ForegroundColor White
  Write-Host '══════════════════════════════════════════════' -ForegroundColor DarkCyan
}

# ── 1. Ce PC a-t-il l'Espace cabinet ? ──
if (-not (Test-Path "$Dest\app\server\index.mjs")) {
  Fin 0 "Rien à mettre à jour sur ce PC : l'Espace cabinet n'y est pas installé.`n  (Seuls le PC du cabinet et le portable du Dr Nouha ont le programme ; les autres PC n'ont rien à faire.)" 'Yellow'
}
if (-not (Test-Path $Payload)) { Fin 1 'Fichier de mise à jour incomplet : retéléchargez-le.' 'Red' }
$cfgFile = "$Dest\data\config.json"
$IsPortable = (Test-Path $cfgFile) -and ((Get-Content $cfgFile -Raw | ConvertFrom-Json).role -eq 'nomade')
$current = if (Test-Path "$Dest\app\VERSION.txt") { VersionOf (Get-Content "$Dest\app\VERSION.txt" -TotalCount 1) } else { '0' }
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [System.IO.Compression.ZipFile]::OpenRead($Payload)
try {
  $entry = $zip.Entries | Where-Object { ($_.FullName -replace '\\', '/') -eq 'commun/app/VERSION.txt' } | Select-Object -First 1
  if (-not $entry) { Fin 1 'Fichier de mise à jour non reconnu.' 'Red' }
  $reader = New-Object System.IO.StreamReader($entry.Open()); $new = VersionOf $reader.ReadLine(); $reader.Close()
} finally { $zip.Dispose() }

if (-not $Elevated) {
  Info ("Ce PC : " + $(if ($IsPortable) { 'portable du Dr Nouha' } else { 'PC du cabinet' }))
  Info "Version installée : $current"
  Info "Nouvelle version  : $new"
  if ([string]::CompareOrdinal($new, $current) -le 0) { Fin 0 "Déjà à jour : rien à faire." }
}

# ── 2. Droits administrateur (la fenêtre actuelle attend la fin) ──
if (-not $Test -and -not $Elevated) {
  $isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
  if (-not $isAdmin) {
    Info "Windows va demander l'accord d'un administrateur…"
    try {
      $p = Start-Process powershell -Verb RunAs -Wait -PassThru -ArgumentList @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', "`"$PSCommandPath`"", '-Payload', "`"$Payload`"", '-Dest', "`"$Dest`"", '-Elevated')
      exit $p.ExitCode
    } catch { Fin 1 "Mise à jour annulée : l'accord administrateur n'a pas été donné." 'Yellow' }
  }
}

# ── Serveur : arrêt / démarrage / vérification ──
$port = if ($Test) { [int]$env:CABINET_PLAIN_PORT } elseif ($IsPortable) { 3475 } else { 443 }
function Listening { [bool](Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue | Where-Object { (Get-Process -Id $_.OwningProcess -ErrorAction SilentlyContinue).Path -like "$Dest\*" }) }
function Stop-Server {
  if (-not $Test) { Stop-ScheduledTask -TaskName $Task -ErrorAction SilentlyContinue }
  Get-Process node -ErrorAction SilentlyContinue | Where-Object { $_.Path -like "$Dest\*" } | Stop-Process -Force -ErrorAction SilentlyContinue
  for ($i = 0; $i -lt 20 -and (Listening); $i++) { Start-Sleep -Milliseconds 500 }
  Start-Sleep -Seconds 1
}
function Start-Server {
  if ($Test) { Start-Process -FilePath "$Dest\node\node.exe" -ArgumentList '--no-warnings', "`"$Dest\app\server\index.mjs`"" -WorkingDirectory "$Dest\app" -WindowStyle Hidden | Out-Null }
  else { Start-ScheduledTask -TaskName $Task }
}
function Healthy {
  for ($i = 0; $i -lt 90 -and -not (Listening); $i++) { Start-Sleep -Milliseconds 500 }
  if (-not (Listening)) { return $false }
  Start-Sleep -Seconds 5              # toujours en marche quelques secondes après le démarrage (migrations faites)
  return (Listening)
}

$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$log = "$Dest\data\mises-a-jour.log"
function Log($t) { Add-Content -Path $log -Value "[$(Get-Date -Format 'dd/MM/yyyy HH:mm:ss')] $t" -Encoding UTF8 }
$work = Join-Path $env:ProgramData "EspaceCabinet\maj-$stamp"
$prev = "$Dest\version-precedente"
$dbSave = "$Dest\data\avant-maj-$stamp"

try {
  # ── 3. Préparation ──
  Etape "Préparation de la version $new"
  New-Item -ItemType Directory -Force -Path $work | Out-Null
  Expand-Archive -Path $Payload -DestinationPath $work -Force
  Get-ChildItem -Path $work -Recurse -File | Unblock-File -ErrorAction SilentlyContinue
  Ok 'Fichiers prêts'

  Etape 'Arrêt du serveur (quelques secondes ; les postes se reconnecteront tout seuls)'
  Stop-Server
  Ok 'Serveur arrêté'

  Etape 'Mise de côté de la base et de la version actuelle'
  New-Item -ItemType Directory -Force -Path $dbSave | Out-Null
  Copy-Item -Path "$Dest\data\cabinet.db*" -Destination $dbSave -Force
  if (Test-Path $prev) { Remove-Item -Recurse -Force $prev }
  New-Item -ItemType Directory -Force -Path $prev | Out-Null
  foreach ($d in 'app', 'node', 'outils') { if (Test-Path "$Dest\$d") { Move-Item "$Dest\$d" "$prev\$d" } }
  Ok "Base copiée dans data\avant-maj-$stamp ; version $current gardée dans version-precedente"
} catch {
  Log "ÉCHEC préparation $current → $new : $($_.Exception.Message)"
  foreach ($d in 'app', 'node', 'outils') { if ((Test-Path "$prev\$d") -and -not (Test-Path "$Dest\$d")) { Move-Item "$prev\$d" "$Dest\$d" } }
  Start-Server
  Fin 1 "Mise à jour interrompue avant tout changement ($($_.Exception.Message)). L'ancienne version tourne toujours." 'Red'
}

# ── 4. Nouvelle version ──
$ok = $false
try {
  Etape 'Installation de la nouvelle version'
  foreach ($d in 'app', 'node', 'outils') { Copy-Item -Recurse -Force "$work\commun\$d" "$Dest\$d" }
  $role = if ($IsPortable) { 'owner' } else { 'staff' }
  Get-ChildItem "$work\commun" -File | Copy-Item -Destination $Dest -Force
  Get-ChildItem "$work\$role" -File | Copy-Item -Destination $Dest -Force
  Ok 'Programme remplacé (données, comptes et sauvegardes inchangés)'

  Etape 'Redémarrage et vérification'
  Start-Server
  $ok = Healthy
} catch { Log "ERREUR installation : $($_.Exception.Message)" }

if (-not $ok) {
  # ── 5. Retour automatique à l'ancienne version ──
  Write-Host '  ✖ La nouvelle version ne démarre pas : retour à la version précédente…' -ForegroundColor Red
  Stop-Server
  foreach ($d in 'app', 'node', 'outils') { if (Test-Path "$Dest\$d") { Remove-Item -Recurse -Force "$Dest\$d" }; Move-Item "$prev\$d" "$Dest\$d" }
  Remove-Item -Force "$Dest\data\cabinet.db*" -ErrorAction SilentlyContinue
  Copy-Item -Path "$dbSave\cabinet.db*" -Destination "$Dest\data" -Force
  Start-Server
  $back = Healthy
  Log "ÉCHEC $current → $new : retour à $current ($(if ($back) { 'serveur relancé' } else { 'SERVEUR ARRÊTÉ' }))"
  Remove-Item -Recurse -Force $work -ErrorAction SilentlyContinue
  if ($back) { Fin 1 "Mise à jour annulée : la version $current a été remise et fonctionne. Prévenez Talel (journal : $log)." 'Yellow' }
  Fin 2 "Mise à jour annulée mais le serveur ne redémarre pas : prévenez Talel. Journal : $log ; serveur : $Dest\data\serveur.log" 'Red'
}

# ── Succès : ménage ──
Remove-Item -Recurse -Force $work -ErrorAction SilentlyContinue
Get-ChildItem "$Dest\data" -Directory -Filter 'avant-maj-*' | Sort-Object Name -Descending | Select-Object -Skip 3 | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
Log "Mise à jour $current → $new réussie ($(if ($IsPortable) { 'portable' } else { 'cabinet' }))"
Ok "Version $new en marche"
$next = if ($IsPortable) { '' } else { "`n  Pensez à lancer le même fichier sur le portable du Dr Nouha." }
Fin 0 "Mise à jour terminée : version $new.$next"
