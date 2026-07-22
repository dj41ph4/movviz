param([Parameter(Mandatory=$true)][string]$OutFile)

# Generates the Movviz app icon (256x256, brand gradient + clapperboard) as a PNG-backed
# .ico. Windows renders it crisply at every shell size.

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$size = 256
$bmp = New-Object System.Drawing.Bitmap($size, $size)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

$rect = New-Object System.Drawing.Rectangle(0, 0, $size, $size)

# Rounded background with violet -> magenta diagonal gradient.
$c1 = [System.Drawing.Color]::FromArgb(124, 58, 237)
$c2 = [System.Drawing.Color]::FromArgb(236, 72, 153)
$brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush($rect, $c1, $c2, 45)

$radius = 56
$path = New-Object System.Drawing.Drawing2D.GraphicsPath
$path.AddArc(0, 0, $radius, $radius, 180, 90)
$path.AddArc($size - $radius, 0, $radius, $radius, 270, 90)
$path.AddArc($size - $radius, $size - $radius, $radius, $radius, 0, 90)
$path.AddArc(0, $size - $radius, $radius, $radius, 90, 90)
$path.CloseFigure()
$g.FillPath($brush, $path)

# Clapperboard body (white with slight opacity)
$boardBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(40, 255, 255, 255))
$boardRect = New-Object System.Drawing.Rectangle(108, 152, 296, 240)
$boardPath = New-Object System.Drawing.Drawing2D.GraphicsPath
$bRad = 20
$boardPath.AddArc($boardRect.X, $boardRect.Y, $bRad, $bRad, 180, 90)
$boardPath.AddArc($boardRect.Right - $bRad, $boardRect.Y, $bRad, $bRad, 270, 90)
$boardPath.AddArc($boardRect.Right - $bRad, $boardRect.Bottom - $bRad, $bRad, $bRad, 0, 90)
$boardPath.AddArc($boardRect.X, $boardRect.Bottom - $bRad, $bRad, $bRad, 90, 90)
$boardPath.CloseFigure()
$g.FillPath($boardBrush, $boardPath)

# Clapper top (white, more opaque)
$clapperBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(230, 255, 255, 255))
$clapperRect = New-Object System.Drawing.Rectangle(108, 108, 296, 108)
$clapperPath = New-Object System.Drawing.Drawing2D.GraphicsPath
$cRad = 20
$clapperPath.AddArc($clapperRect.X, $clapperRect.Y, $cRad, $cRad, 180, 90)
$clapperPath.AddArc($clapperRect.Right - $cRad, $clapperRect.Y, $cRad, $cRad, 270, 90)
$clapperPath.AddArc($clapperRect.Right - $cRad, $clapperRect.Bottom - $cRad, $cRad, $cRad, 0, 90)
$clapperPath.AddArc($clapperRect.X, $clapperRect.Bottom - $cRad, $cRad, $cRad, 90, 90)
$clapperPath.CloseFigure()
$g.FillPath($clapperBrush, $clapperPath)

# Clapper stripes (diagonal lines in brand color)
$stripePen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(100, 124, 58, 237), 8)
$stripePen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
$stripePen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
for ($x = 188; $x -le 348; $x += 80) {
    $g.DrawLine($stripePen, $x, 108, $x - 32, 216)
}

# Hinge circles
$hingeBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(230, 255, 255, 255))
$g.FillEllipse($hingeBrush, 144, 276, 48, 48)
$g.FillEllipse($hingeBrush, 320, 276, 48, 48)

# Center line on clapper
$centerPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(100, 124, 58, 237), 8)
$centerPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
$centerPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
$g.DrawLine($centerPen, 140, 280, 372, 280)

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