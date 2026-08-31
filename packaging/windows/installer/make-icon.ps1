param([Parameter(Mandatory=$true)][string]$OutFile)

# Canonical Movviz Windows icon — same pink/violet gradient + white clapperboard
# as Android, PWA and Docker branding. A 512px master is rendered once, then
# packed into a multi-resolution ICO for crisp 16/20/24/32/40/48/64/128/256px shell use.
$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

function New-RoundedPath([float]$x, [float]$y, [float]$w, [float]$h, [float]$r) {
    $p = New-Object System.Drawing.Drawing2D.GraphicsPath
    $d = 2 * $r
    $p.AddArc($x, $y, $d, $d, 180, 90)
    $p.AddArc($x + $w - $d, $y, $d, $d, 270, 90)
    $p.AddArc($x + $w - $d, $y + $h - $d, $d, $d, 0, 90)
    $p.AddArc($x, $y + $h - $d, $d, $d, 90, 90)
    $p.CloseFigure()
    return $p
}

$masterSize = 512
$master = New-Object System.Drawing.Bitmap($masterSize, $masterSize, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g = [System.Drawing.Graphics]::FromImage($master)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$g.Clear([System.Drawing.Color]::Transparent)

$rect = New-Object System.Drawing.Rectangle(0, 0, $masterSize, $masterSize)
$c1 = [System.Drawing.ColorTranslator]::FromHtml("#F33FBC")
$c2 = [System.Drawing.ColorTranslator]::FromHtml("#8E37F7")
$gradient = New-Object System.Drawing.Drawing2D.LinearGradientBrush($rect, $c1, $c2, 45)
$white = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)

# Rounded app tile.
$tile = New-RoundedPath 0 0 512 512 112
$g.FillPath($gradient, $tile)

# Lower clapper body with the center cut-out revealing the gradient.
$body = New-RoundedPath 98 225 316 199 35
$g.FillPath($white, $body)
$window = New-RoundedPath 135 272 242 112 7
$g.FillPath($gradient, $window)

# Angled upper clapper.
$state = $g.Save()
$g.TranslateTransform(256, 180)
$g.RotateTransform(-15)
$g.TranslateTransform(-256, -180)
$top = New-RoundedPath 103 126 307 104 25
$g.FillPath($white, $top)
foreach ($x in @(132, 221, 310)) {
    $hole = New-RoundedPath $x 151 58 43 7
    $g.FillPath($gradient, $hole)
    $hole.Dispose()
}
$g.Restore($state)

$tile.Dispose(); $body.Dispose(); $window.Dispose(); $top.Dispose()
$white.Dispose(); $gradient.Dispose(); $g.Dispose()

$sizes = @(16, 20, 24, 32, 40, 48, 64, 128, 256)
$images = @()
foreach ($size in $sizes) {
    $bmp = New-Object System.Drawing.Bitmap($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $sg = [System.Drawing.Graphics]::FromImage($bmp)
    $sg.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
    $sg.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $sg.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $sg.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $sg.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $sg.DrawImage($master, 0, 0, $size, $size)
    $sg.Dispose()

    $ms = New-Object System.IO.MemoryStream
    $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    $images += ,@($size, $ms.ToArray())
    $ms.Dispose()
}
$master.Dispose()

$fs = [System.IO.File]::Create($OutFile)
$bw = New-Object System.IO.BinaryWriter($fs)
try {
    $bw.Write([UInt16]0)
    $bw.Write([UInt16]1)
    $bw.Write([UInt16]$images.Count)

    $offset = 6 + (16 * $images.Count)
    foreach ($item in $images) {
        $size = [int]$item[0]
        $png = [byte[]]$item[1]
        $dim = if ($size -eq 256) { [byte]0 } else { [byte]$size }
        $bw.Write($dim); $bw.Write($dim)
        $bw.Write([byte]0); $bw.Write([byte]0)
        $bw.Write([UInt16]1); $bw.Write([UInt16]32)
        $bw.Write([UInt32]$png.Length)
        $bw.Write([UInt32]$offset)
        $offset += $png.Length
    }
    foreach ($item in $images) { $bw.Write([byte[]]$item[1]) }
} finally {
    $bw.Flush(); $bw.Dispose(); $fs.Dispose()
}

Write-Host "icon written: $OutFile (Movviz canonical multi-size)"
