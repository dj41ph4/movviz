param([Parameter(Mandatory=$true)][string]$OutFile)

# Generates the Movviz app icon (256x256, brand gradient + "M") as a PNG-backed
# .ico. Windows renders it crisply at every shell size.

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$size = 256
$bmp = New-Object System.Drawing.Bitmap($size, $size)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

$rect = New-Object System.Drawing.Rectangle(0, 0, $size, $size)

# Rounded background with a violet -> magenta diagonal gradient.
$c1 = [System.Drawing.Color]::FromArgb(124, 92, 255)
$c2 = [System.Drawing.Color]::FromArgb(192, 75, 255)
$brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush($rect, $c1, $c2, 45)

$radius = 56
$path = New-Object System.Drawing.Drawing2D.GraphicsPath
$path.AddArc(0, 0, $radius, $radius, 180, 90)
$path.AddArc($size - $radius, 0, $radius, $radius, 270, 90)
$path.AddArc($size - $radius, $size - $radius, $radius, $radius, 0, 90)
$path.AddArc(0, $size - $radius, $radius, $radius, 90, 90)
$path.CloseFigure()
$g.FillPath($brush, $path)

# Centered bold "M".
$font = New-Object System.Drawing.Font("Segoe UI", 148, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
$sf = New-Object System.Drawing.StringFormat
$sf.Alignment = [System.Drawing.StringAlignment]::Center
$sf.LineAlignment = [System.Drawing.StringAlignment]::Center
$layout = New-Object System.Drawing.RectangleF(0, -6, $size, $size)
$g.DrawString("M", $font, [System.Drawing.Brushes]::White, $layout, $sf)
$g.Dispose()

# Encode PNG.
$ms = New-Object System.IO.MemoryStream
$bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
$png = $ms.ToArray()
$ms.Dispose(); $bmp.Dispose()

# Wrap the PNG in a minimal single-image ICO container.
$fs = [System.IO.File]::Create($OutFile)
$bw = New-Object System.IO.BinaryWriter($fs)
$bw.Write([UInt16]0)            # reserved
$bw.Write([UInt16]1)            # type = icon
$bw.Write([UInt16]1)            # image count
$bw.Write([Byte]0)             # width  (0 => 256)
$bw.Write([Byte]0)             # height (0 => 256)
$bw.Write([Byte]0)             # palette
$bw.Write([Byte]0)             # reserved
$bw.Write([UInt16]1)           # color planes
$bw.Write([UInt16]32)          # bits per pixel
$bw.Write([UInt32]$png.Length) # image size
$bw.Write([UInt32]22)          # offset to image data
$bw.Write($png)
$bw.Flush(); $fs.Close()

Write-Host "icon written: $OutFile"
