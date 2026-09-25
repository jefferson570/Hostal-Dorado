# optimizar-fotos.ps1
# ---------------------------------------------------------------
# Optimiza las fotos de public-site/img/fotos para la web:
#   - Endereza las fotos según la orientación que guardó el celular (EXIF).
#   - Reduce a un máximo de 1600 px de lado.
#   - Guarda como JPG de calidad 82 (livianas y nítidas).
#   - Convierte .png y .jpeg a .jpg (nombre en minúsculas, sin espacios).
# Los originales se guardan en herramientas/fotos-originales/ (fuera de
# la web, para que no se publiquen) por si hay que volver a procesarlas.
#
# Uso (desde la carpeta del proyecto):
#   powershell -ExecutionPolicy Bypass -File herramientas\optimizar-fotos.ps1
#   Para girar una foto a mano:  ... -Girar estandar.jpg=90   (90, 180 o 270)
param([string[]]$Girar = @())

Add-Type -AssemblyName System.Drawing
$carpeta = Join-Path $PSScriptRoot '..\public-site\img\fotos' | Resolve-Path
$originales = Join-Path $PSScriptRoot 'fotos-originales'
New-Item -ItemType Directory -Force $originales | Out-Null

$giros = @{}
foreach ($g in $Girar) { $n, $gr = $g -split '='; $giros[$n.ToLower()] = [int]$gr }

$codec = [Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object MimeType -eq 'image/jpeg'
$params = New-Object Drawing.Imaging.EncoderParameters 1
$params.Param[0] = New-Object Drawing.Imaging.EncoderParameter ([Drawing.Imaging.Encoder]::Quality), 82L
$MAX = 1600

Get-ChildItem $carpeta -File | Where-Object { $_.Extension -match '^\.(jpe?g|png)$' } | ForEach-Object {
  $archivo = $_
  $destino = Join-Path $carpeta (($archivo.BaseName.ToLower() -replace '\s+', '-') + '.jpg')
  $copia = Join-Path $originales $archivo.Name
  if (-not (Test-Path $copia)) { Copy-Item $archivo.FullName $copia }

  $img = [Drawing.Image]::FromFile($copia)
  try {
    # Orientación EXIF (0x0112): la aplica y la quita.
    if ($img.PropertyIdList -contains 0x0112) {
      switch ([int]$img.GetPropertyItem(0x0112).Value[0]) {
        3 { $img.RotateFlip('Rotate180FlipNone') }
        6 { $img.RotateFlip('Rotate90FlipNone') }
        8 { $img.RotateFlip('Rotate270FlipNone') }
      }
    }
    $giro = $giros[[IO.Path]::GetFileName($destino).ToLower()]
    if ($giro -eq 90)  { $img.RotateFlip('Rotate90FlipNone') }
    if ($giro -eq 180) { $img.RotateFlip('Rotate180FlipNone') }
    if ($giro -eq 270) { $img.RotateFlip('Rotate270FlipNone') }

    $escala = [Math]::Min(1, $MAX / [Math]::Max($img.Width, $img.Height))
    $w = [int]($img.Width * $escala); $h = [int]($img.Height * $escala)
    $bmp = New-Object Drawing.Bitmap $w, $h
    $gfx = [Drawing.Graphics]::FromImage($bmp)
    $gfx.InterpolationMode = 'HighQualityBicubic'
    $gfx.SmoothingMode = 'HighQuality'
    $gfx.PixelOffsetMode = 'HighQuality'
    $gfx.DrawImage($img, 0, 0, $w, $h)
    $gfx.Dispose()
  } finally { $img.Dispose() }

  if ($archivo.FullName -ne $destino) { Remove-Item $archivo.FullName }
  $bmp.Save($destino, $codec, $params)
  $bmp.Dispose()
  '{0,-22} {1}x{2}  {3:N0} KB' -f [IO.Path]::GetFileName($destino), $w, $h, ((Get-Item $destino).Length / 1KB)
}
