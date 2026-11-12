# ═══════════════════════════════════════════
#  Espace cabinet — démarrer / arrêter / état / restaurer / désinstaller
#  Usage : gerer.ps1 -Action demarrer|arreter|etat|restaurer|desinstaller|comptes
#  comptes : outil « comptes protégés », uniquement sur le portable du Dr Nouha
# ═══════════════════════════════════════════
param([Parameter(Mandatory)][ValidateSet('demarrer', 'arreter', 'etat', 'restaurer', 'desinstaller', 'comptes')] [string]$Action)
$ErrorActionPreference = 'Stop'
$Dest = 'C:\EspaceCabinet'
$Task = 'Espace cabinet Nouha'
$Name = 'cabinet-nouha.local'
function Pause-End { Write-Host ''; Read-Host 'Appuyez sur Entrée pour fermer' | Out-Null }
$IsPortable = (Test-Path "$Dest\data\config.json") -and ((Get-Content "$Dest\data\config.json" -Raw | ConvertFrom-Json).role -eq 'nomade')
$ListenPort = if ($IsPortable) { 3475 } else { 443 }
$Url = if ($IsPortable) { 'http://localhost:3475' } else { "https://$Name" }
function Running { [bool](Get-NetTCPConnection -State Listen -LocalPort $ListenPort -ErrorAction SilentlyContinue | Where-Object { (Get-Process -Id $_.OwningProcess -ErrorAction SilentlyContinue).Path -like "$Dest\*" }) }
function Stop-Server {
  Stop-ScheduledTask -TaskName $Task -ErrorAction SilentlyContinue
  Get-Process node -ErrorAction SilentlyContinue | Where-Object { $_.Path -like "$Dest\*" } | Stop-Process -Force -ErrorAction SilentlyContinue
  Start-Sleep -Seconds 2
}

switch ($Action) {
  'demarrer' {
    Start-ScheduledTask -TaskName $Task
    for ($i = 0; $i -lt 30 -and -not (Running); $i++) { Start-Sleep -Milliseconds 500 }
    if (Running) { Write-Host "✔ Serveur en marche : $Url" -ForegroundColor Green } else { Write-Host "✖ Le serveur n'a pas démarré : voir $Dest\data\serveur.log" -ForegroundColor Red }
    Pause-End
  }
  'arreter' {
    Write-Host 'Arrêt du serveur… (les postes ne pourront plus se connecter)'
    Stop-Server
    Write-Host '✔ Serveur arrêté. Il redémarrera au prochain allumage du PC, ou avec DEMARRER.cmd.' -ForegroundColor Green
    Pause-End
  }
  'etat' {
    $t = Get-ScheduledTask -TaskName $Task -ErrorAction SilentlyContinue
    Write-Host '══ Espace cabinet : état ══' -ForegroundColor Cyan
    Write-Host ("Serveur           : " + $(if (Running) { 'EN MARCHE' } else { 'ARRÊTÉ' }))
    Write-Host ("Démarrage auto    : " + $(if ($t) { 'oui (' + $t.State + ')' } else { 'NON INSTALLÉ' }))
    Write-Host ("Type              : " + $(if ($IsPortable) { 'PORTABLE du Dr Nouha (synchronisé avec le cabinet)' } else { 'PC du cabinet (référence)' }))
    Write-Host ("Adresse           : $Url")
    if ($IsPortable -and (Test-Path "$Dest\data\portable.json")) {
      $pj = Get-Content "$Dest\data\portable.json" -Raw | ConvertFrom-Json
      $ls = if ($pj.lastSync) { ([DateTimeOffset]::FromUnixTimeMilliseconds([int64]$pj.lastSync)).LocalDateTime.ToString('dd/MM/yyyy HH:mm') } else { 'jamais' }
      Write-Host ("Associé au cabinet: " + $(if ($pj.paired) { 'oui' } else { 'NON' }) + "   ·   dernière synchronisation : $ls")
    }
    $ip = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' -and $_.PrefixOrigin -ne 'WellKnown' } | Select-Object -First 1).IPAddress
    Write-Host ("Adresse IP du PC  : $ip")
    $b = Get-ChildItem "$Dest\data\backups\*.cnbk" -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending
    Write-Host ("Sauvegardes       : " + $b.Count + $(if ($b) { ' (dernière : ' + $b[0].LastWriteTime.ToString('dd/MM/yyyy HH:mm') + ')' } else { '' }))
    $free = [math]::Round((Get-PSDrive C).Free / 1GB, 1)
    Write-Host ("Espace libre C:   : $free Go")
    Write-Host ''
    Write-Host '── Dernières lignes du journal ──' -ForegroundColor Cyan
    if (Test-Path "$Dest\data\serveur.log") { Get-Content "$Dest\data\serveur.log" -Tail 12 | ForEach-Object { $_ -replace "code d'installation : \S+", "code d'installation : ********" } }
    Pause-End
  }
  'restaurer' {
    Add-Type -AssemblyName System.Windows.Forms
    $dlg = New-Object System.Windows.Forms.OpenFileDialog
    $dlg.Title = 'Choisir la sauvegarde à restaurer (.cnbk)'
    $dlg.Filter = 'Sauvegarde Espace cabinet (*.cnbk)|*.cnbk'
    $dlg.InitialDirectory = "$Dest\data\backups"
    if ($dlg.ShowDialog() -ne 'OK') { exit }
    Write-Host "Sauvegarde choisie : $($dlg.FileName)"
    $key = Read-Host 'Clé de sauvegarde (laisser vide sur le PC habituel ; sur un nouveau PC, la saisir depuis la feuille imprimée)'
    $ok = Read-Host 'La base actuelle sera mise de côté puis remplacée. Continuer ? (oui/non)'
    if ($ok -ne 'oui') { exit }
    Stop-Server
    $args2 = @('--no-warnings', "$Dest\app\tools\restore.mjs", $dlg.FileName)
    if ($key) { $args2 += @('--cle', $key.Trim()) }
    & "$Dest\node\node.exe" @args2
    Start-ScheduledTask -TaskName $Task
    if (-not $IsPortable -and (Test-Path "$Dest\data\tls\ca.crt")) {
      # PC de remplacement : le certificat du cabinet repris de la sauvegarde est approuvé sur ce PC
      $ca = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2 "$Dest\data\tls\ca.crt"
      Get-ChildItem Cert:\LocalMachine\Root | Where-Object { $_.Subject -like '*Cabinet Dr Nouha Ksiksi*' -and $_.Thumbprint -ne $ca.Thumbprint } | Remove-Item -ErrorAction SilentlyContinue
      Import-Certificate -FilePath "$Dest\data\tls\ca.crt" -CertStoreLocation Cert:\LocalMachine\Root | Out-Null
      Write-Host '✔ Certificat du cabinet approuvé sur ce PC' -ForegroundColor Green
    }
    Pause-End
  }
  'comptes' {
    $node = "$Dest\node\node.exe"; $tool = "$Dest\app\tools\comptes.mjs"
    if (-not $IsPortable) { Write-Host '✖ Cet outil ne fonctionne que sur le portable du Dr Nouha.' -ForegroundColor Red; Pause-End; exit 1 }
    Write-Host '══ Comptes protégés : Dr Nouha et administrateur informatique ══' -ForegroundColor Cyan
    & $node --no-warnings $tool etat
    Write-Host ''
    Write-Host '  1  Réinitialiser le compte du Dr Nouha    (mot de passe oublié)'
    Write-Host '  2  Réinitialiser le compte de Talel       (mot de passe oublié)'
    Write-Host '  3  Changer le nom affiché du Dr Nouha'
    Write-Host '  4  Changer le nom affiché de Talel'
    Write-Host '  Entrée : quitter sans rien changer'
    $c = Read-Host 'Choix'
    $who = if ($c -in '1', '3') { 'nouha' } elseif ($c -in '2', '4') { 'talel' } else { $null }
    if (-not $who) { exit }
    if ($c -in '1', '2') {
      Write-Host ''
      Write-Host "  Le mot de passe actuel de « $who » cessera de fonctionner partout (cabinet et portable)." -ForegroundColor Yellow
      if ($who -eq 'nouha') { Write-Host '  Ensuite, l''accès aux dossiers se récupère avec la FEUILLE DE SECOURS imprimée : l''avoir sous la main.' -ForegroundColor Yellow }
      if ((Read-Host 'Tapez OUI pour continuer') -ne 'OUI') { exit }
      & $node --no-warnings $tool reinitialiser $who
    } else {
      $name = Read-Host 'Nouveau nom affiché'
      if ($name) { & $node --no-warnings $tool renommer $who $name }
    }
    Pause-End
  }
  'desinstaller' {
    Write-Host 'Désinstallation de l''Espace cabinet.' -ForegroundColor Yellow
    $del = Read-Host 'Supprimer aussi les DONNÉES (dossiers patients, sauvegardes) ? Tapez SUPPRIMER pour les effacer, ou Entrée pour les garder'
    Stop-Server
    Unregister-ScheduledTask -TaskName $Task -Confirm:$false -ErrorAction SilentlyContinue
    Get-NetFirewallRule -DisplayName 'Espace cabinet*' -ErrorAction SilentlyContinue | Remove-NetFirewallRule
    $hosts = "$env:SystemRoot\System32\drivers\etc\hosts"
    (Get-Content $hosts) | Where-Object { $_ -notmatch [regex]::Escape($Name) } | Set-Content $hosts -Encoding ASCII
    Get-ChildItem Cert:\LocalMachine\Root | Where-Object { $_.Subject -like '*Cabinet Dr Nouha Ksiksi*' } | Remove-Item -ErrorAction SilentlyContinue
    Remove-Item "$env:PUBLIC\Desktop\Espace cabinet*.url" -ErrorAction SilentlyContinue
    foreach ($d in 'app', 'node', 'outils') { Remove-Item -Recurse -Force "$Dest\$d" -ErrorAction SilentlyContinue }
    Get-ChildItem $Dest -File -ErrorAction SilentlyContinue | Remove-Item -Force
    if ($del -eq 'SUPPRIMER') { Remove-Item -Recurse -Force "$Dest\data"; Remove-Item -Force $Dest -ErrorAction SilentlyContinue; Write-Host '✔ Programme et données supprimés.' -ForegroundColor Green }
    else { Write-Host "✔ Programme désinstallé. Données conservées dans $Dest\data" -ForegroundColor Green }
    Pause-End
  }
}
