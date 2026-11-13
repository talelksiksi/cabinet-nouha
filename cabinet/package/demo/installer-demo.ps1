# Espace cabinet — démonstration pour relecture.
# Installe dans le profil de l'utilisateur (aucun droit administrateur), crée un raccourci sur le bureau et lance la démo.
# Données 100 % fictives, créées au lancement. Rien n'est accessible depuis le réseau (uniquement ce PC).
param([Parameter(Mandatory)][string]$Payload)
$ErrorActionPreference = 'Stop'
$Host.UI.RawUI.WindowTitle = 'Espace cabinet - démonstration'
$Dest = Join-Path $env:LOCALAPPDATA 'EspaceCabinet-Demo'
function Say($m, $c = 'Gray') { Write-Host $m -ForegroundColor $c }

try {
  Say ''
  Say '  Espace cabinet — Dr Nouha Ksiksi' 'Cyan'
  Say '  Démonstration (patients et chiffres fictifs)' 'Cyan'
  Say ''

  # Une démonstration déjà ouverte : on ferme son serveur ET sa fenêtre (qui garde le dossier ouvert) avant de la remplacer
  function Stop-OldDemo {
    $ids = @()
    $ids += Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
      Where-Object { ($_.ExecutablePath -and $_.ExecutablePath.StartsWith($Dest, [StringComparison]::OrdinalIgnoreCase)) -or
                     ($_.CommandLine -and $_.CommandLine.IndexOf('EspaceCabinet-Demo', [StringComparison]::OrdinalIgnoreCase) -ge 0) } |
      ForEach-Object { $_.ProcessId }
    $ids += Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Where-Object { $_.LocalPort -in 3475, 3476, 3485, 3486 } |
      ForEach-Object { $_.OwningProcess }
    $ids | Where-Object { $_ -and $_ -ne $PID } | Sort-Object -Unique | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }
  }
  if ((Test-Path $Dest) -or (Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Where-Object { $_.LocalPort -in 3475, 3476 })) {
    Say '  Fermeture de la démonstration déjà ouverte…'
    Stop-OldDemo
  }

  Say '  Copie des fichiers…'
  for ($try = 1; Test-Path $Dest; $try++) {
    try { Remove-Item -Recurse -Force $Dest -ErrorAction Stop }
    catch {
      if ($try -ge 10) { throw "Le dossier de l'ancienne démonstration est encore utilisé. Fermez toutes les fenêtres « Espace cabinet », puis relancez ce fichier." }
      Stop-OldDemo; Start-Sleep -Seconds 1
    }
  }
  New-Item -ItemType Directory -Force $Dest | Out-Null
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  $zip = [IO.Compression.ZipFile]::OpenRead($Payload)
  try {
    foreach ($e in $zip.Entries) {
      $rel = $e.FullName -replace '\\', '/'
      if ($rel.EndsWith('/')) { continue }
      $out = Join-Path $Dest ($rel -replace '/', '\')
      $dir = Split-Path $out
      if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Force $dir | Out-Null }
      [IO.Compression.ZipFileExtensions]::ExtractToFile($e, $out, $true)
    }
  } finally { $zip.Dispose() }
  if (-not (Test-Path (Join-Path $Dest 'node\node.exe'))) { throw 'Fichiers incomplets après extraction.' }

  Say '  Raccourci sur le bureau…'
  $desk = [Environment]::GetFolderPath('Desktop')
  $sh = New-Object -ComObject WScript.Shell
  $lnk = $sh.CreateShortcut((Join-Path $desk 'Espace cabinet (démo).lnk'))
  $lnk.TargetPath = Join-Path $Dest 'DEMARRER-DEMO.cmd'
  $lnk.WorkingDirectory = $Dest
  $lnk.IconLocation = (Join-Path $Dest 'app\public\favicon.ico') + ',0'
  $lnk.Description = 'Espace cabinet - démonstration (données fictives)'
  $lnk.Save()
  $g = $sh.CreateShortcut((Join-Path $desk 'Guide de la démo Espace cabinet.lnk'))
  $g.TargetPath = Join-Path $Dest 'GUIDE-DEMO.html'
  $g.Save()

  Say '  Lancement de la démonstration…' 'Green'
  Start-Process -FilePath (Join-Path $Dest 'DEMARRER-DEMO.cmd') -WorkingDirectory $Dest
  Start-Process (Join-Path $Dest 'GUIDE-DEMO.html')
  Say ''
  Say '  C''est prêt. Une fenêtre noire reste ouverte pendant la démonstration :' 'Green'
  Say '  elle affiche le mot de passe des comptes. La fermer arrête la démonstration.'
  Say '  Pour la relancer plus tard : icône « Espace cabinet (démo) » sur le bureau.'
  Say ''
  Start-Sleep -Seconds 6
} catch {
  Say ''
  Say ('  Échec : ' + $_.Exception.Message) 'Red'
  Say '  Envoyez une photo de cet écran à Talel.' 'Yellow'
  Read-Host '  Appuyez sur Entrée pour fermer'
  exit 1
}
