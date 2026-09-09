param([Parameter(Mandatory=$true)][string]$OutFile)

# Canonical Movviz Windows icon — loads the official 512px artwork (checked
# into this folder as movviz-icon-source.png, the same file used for the web
# favicon and Android launcher icons) and packs it into a multi-resolution
# ICO for crisp 16/20/24/32/40/48/64/128/256px shell use. Never redraw the
# mark procedurally here — always composite the real source file.
$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$sourcePath = Join-Path $PSScriptRoot "movviz-icon-source.png"
$master = [System.Drawing.Bitmap]::FromFile((Resolve-Path $sourcePath))

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
