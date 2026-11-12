# ═══════════════════════════════════════════
#  Espace cabinet — préparer un AUTRE PC du cabinet (pas le serveur)
#  Lancé par POSTE-CABINET.cmd (droits administrateur), PC sur le Wi-Fi / réseau du personnel, PC du cabinet allumé.
#  1. récupère le certificat du cabinet sur le PC serveur et l'approuve sur ce PC ;
#  2. si le nom cabinet-nouha.local ne répond pas, l'associe à l'adresse IP du serveur ;
#  3. crée le raccourci « Espace cabinet » (avec l'icône du cabinet) sur le bureau.
#  Rien n'est installé d'autre ; aucune donnée n'est copiée sur ce PC.
# ═══════════════════════════════════════════
$ErrorActionPreference = 'Stop'
$Host.UI.RawUI.WindowTitle = 'Espace cabinet - préparer ce poste'
$Src  = Split-Path -Parent $PSScriptRoot
$Name = 'cabinet-nouha.local'
$Dir  = "$env:ProgramData\EspaceCabinet"
function Ok($t)   { Write-Host "  ✔ $t" -ForegroundColor Green }
function Fail($t) { Write-Host ''; Write-Host "✖ $t" -ForegroundColor Red; Write-Host ''; Read-Host 'Appuyez sur Entrée pour fermer'; exit 1 }

Write-Host '══════════════════════════════════════════════' -ForegroundColor DarkCyan
Write-Host '  Espace cabinet — préparer ce poste' -ForegroundColor White
Write-Host '══════════════════════════════════════════════' -ForegroundColor DarkCyan
if (Get-ScheduledTask -TaskName 'Espace cabinet Nouha' -ErrorAction SilentlyContinue) { Fail 'Ce PC est le serveur (ou le portable) : il est déjà prêt, rien à faire ici.' }

# ── 1. Trouver le PC du cabinet ──
$hostOk = $false
try { $hostOk = [bool]([System.Net.Dns]::GetHostAddresses($Name) | Where-Object { $_.AddressFamily -eq 'InterNetwork' }) } catch {}   # résolution Windows (mDNS compris)
$target = $Name
if (-not $hostOk) {
  Write-Host "  Le nom $Name ne répond pas sur ce PC." -ForegroundColor Yellow
  $ip = Read-Host '  Adresse IP du PC du cabinet (affichée par ETAT.cmd sur le serveur, ex. 192.168.1.20)'
  if ($ip -notmatch '^\d{1,3}(\.\d{1,3}){3}$') { Fail 'Adresse IP invalide.' }
  $target = $ip
}
try { $null = Invoke-WebRequest -UseBasicParsing -Uri "http://$target/certificat" -TimeoutSec 8 }
catch { Fail "PC du cabinet injoignable ($target). Vérifiez : ce PC est sur le réseau du PERSONNEL (pas le réseau invités), le PC du cabinet est allumé." }
Ok "PC du cabinet trouvé ($target)"

# ── 2. Certificat du cabinet ──
New-Item -ItemType Directory -Force -Path $Dir | Out-Null
$crt = "$Dir\cabinet-nouha-ca.crt"
Invoke-WebRequest -UseBasicParsing -Uri "http://$target/cabinet-nouha-ca.crt" -OutFile $crt -TimeoutSec 10
$cert = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2 $crt
if ($cert.Subject -notlike '*Cabinet Dr Nouha Ksiksi*') { Fail "Certificat inattendu ($($cert.Subject)) : installation interrompue." }
Write-Host "  Empreinte du certificat : $($cert.Thumbprint)"
Get-ChildItem Cert:\LocalMachine\Root | Where-Object { $_.Subject -like '*Cabinet Dr Nouha Ksiksi*' -and $_.Thumbprint -ne $cert.Thumbprint } | Remove-Item -ErrorAction SilentlyContinue
Import-Certificate -FilePath $crt -CertStoreLocation Cert:\LocalMachine\Root | Out-Null
Ok 'Connexion sécurisée approuvée sur ce PC'

# ── 3. Nom du cabinet (seulement si le réseau ne le donne pas) ──
if (-not $hostOk) {
  $hosts = "$env:SystemRoot\System32\drivers\etc\hosts"
  $lines = (Get-Content $hosts) | Where-Object { $_ -notmatch [regex]::Escape($Name) }
  Set-Content -Path $hosts -Value ($lines + "$target $Name   # Espace cabinet") -Encoding ASCII
  Ok "$Name → $target (pensez à réserver cette adresse dans la box)"
}

# ── 4. Raccourci sur le bureau, avec l'icône du cabinet ──
Copy-Item -Force "$Src\app\public\favicon.ico" "$Dir\espace-cabinet.ico"
Remove-Item "$env:PUBLIC\Desktop\Espace cabinet*.url" -ErrorAction SilentlyContinue
Set-Content -Path "$env:PUBLIC\Desktop\Espace cabinet.url" -Value "[InternetShortcut]`r`nURL=https://$Name/`r`nIconFile=$Dir\espace-cabinet.ico`r`nIconIndex=0" -Encoding ASCII
Ok 'Raccourci « Espace cabinet » sur le bureau'

Write-Host ''
Write-Host '  Terminé. Fermez complètement le navigateur s''il était ouvert, puis ouvrez le raccourci du bureau.' -ForegroundColor Green
Write-Host '  Le cadenas doit apparaître dans la barre d''adresse, sans avertissement.'
Start-Process "https://$Name/"
Read-Host 'Appuyez sur Entrée pour fermer'
