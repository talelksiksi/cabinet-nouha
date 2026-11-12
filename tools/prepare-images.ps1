# Prépare les images du site : découpe les montages avant/après en deux images, extrait le logo.
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$root = Split-Path -Parent $PSScriptRoot
$src = Join-Path $root 'assets'
$out = Join-Path $root 'site\img'
New-Item -ItemType Directory -Force "$out\cas", "$out\photos" | Out-Null

$jpeg = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
$params = New-Object System.Drawing.Imaging.EncoderParameters 1
$params.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter ([System.Drawing.Imaging.Encoder]::Quality), 82L

function Save-Crop($img, [int]$x, [int]$y, [int]$w, [int]$h, $file, [int]$maxW = 1200) {
  $scale = [Math]::Min(1, $maxW / $w)
  $bw = [int]($w * $scale); $bh = [int]($h * $scale)
  $bmp = New-Object System.Drawing.Bitmap $bw, $bh
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = 'HighQualityBicubic'
  $g.DrawImage($img, (New-Object System.Drawing.Rectangle 0, 0, $bw, $bh), (New-Object System.Drawing.Rectangle $x, $y, $w, $h), 'Pixel')
  $g.Dispose()
  $bmp.Save($file, $jpeg, $params)   # ré-encodage : les métadonnées d'origine (EXIF) ne sont pas recopiées
  $bmp.Dispose()
}

# Montages haut = avant / bas = après : découpe en deux moitiés (on retire 2 % autour de la jointure)
$cases = @(
  @{ f = 'cas-01-rehabilitation-complete'; split = 0.50 },
  @{ f = 'cas-02-rehabilitation-prothese'; split = 0.59 },
  @{ f = 'cas-03-facettes-couronnes'; split = 0.50 },
  @{ f = 'cas-04-bridge-anterieur'; split = 0.50 },
  @{ f = 'cas-05-fermeture-diasteme'; split = 0.53 }
)
foreach ($c in $cases) {
  $img = [System.Drawing.Image]::FromFile((Join-Path $src "photos\avant-apres\$($c.f).jpg"))
  $W = $img.Width; $H = $img.Height; $cut = [int]($H * $c.split); $m = [int]($H * 0.01)
  Save-Crop $img 0 0 $W ($cut - $m) (Join-Path $out "cas\$($c.f)-avant.jpg")
  Save-Crop $img 0 ($cut + $m) $W ($H - $cut - $m) (Join-Path $out "cas\$($c.f)-apres.jpg")
  $img.Dispose()
}

# Photos (redimensionnées, sans métadonnées)
foreach ($p in @('equipe\dr-nouha-ksiksi-portrait', 'cabinet\chirurgie-implant-salle', 'cabinet\chirurgie-en-cours')) {
  $img = [System.Drawing.Image]::FromFile((Join-Path $src "photos\$p.jpg"))
  Save-Crop $img 0 0 $img.Width $img.Height (Join-Path $out "photos\$(Split-Path $p -Leaf).jpg") 1000
  $img.Dispose()
}
# Bannière (pour la salle, en arrière-plan) et fiche FR
$img = [System.Drawing.Image]::FromFile((Join-Path $src 'marque\banniere-cabinet-bleu-or.jpg'))
Save-Crop $img 395 20 250 196 (Join-Path $out 'logo-banniere.jpg') 250
$img.Dispose()
$img = [System.Drawing.Image]::FromFile((Join-Path $src 'marque\fiche-prothese-implants-fr.jpg'))
Save-Crop $img 0 0 $img.Width $img.Height (Join-Path $out 'photos\fiche-prothese-implants-fr.jpg') 900
$img.Dispose()
Get-ChildItem $out -Recurse -File | ForEach-Object { '{0,-52} {1,5:N0} Ko' -f $_.FullName.Replace("$out\", ''), ($_.Length / 1KB) }
