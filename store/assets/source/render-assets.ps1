param(
  [string]$ExtensionIcon = (Join-Path $PSScriptRoot "..\..\..\rutracker-visual-enhancer\icons\icon-128.png"),
  [string]$OutputDirectory = (Join-Path $PSScriptRoot "..")
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

function New-RoundedPath([float]$x, [float]$y, [float]$width, [float]$height, [float]$radius) {
  $path = [Drawing.Drawing2D.GraphicsPath]::new()
  $diameter = $radius * 2
  $path.AddArc($x, $y, $diameter, $diameter, 180, 90)
  $path.AddArc($x + $width - $diameter, $y, $diameter, $diameter, 270, 90)
  $path.AddArc($x + $width - $diameter, $y + $height - $diameter, $diameter, $diameter, 0, 90)
  $path.AddArc($x, $y + $height - $diameter, $diameter, $diameter, 90, 90)
  $path.CloseFigure()
  return $path
}

function New-Canvas([int]$width, [int]$height) {
  $bitmap = [Drawing.Bitmap]::new($width, $height, [Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $bitmap.SetResolution(96, 96)
  $graphics = [Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.InterpolationMode = [Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.TextRenderingHint = [Drawing.Text.TextRenderingHint]::AntiAliasGridFit
  return @{ Bitmap = $bitmap; Graphics = $graphics }
}

function Draw-RoundedRect($graphics, $brush, [float]$x, [float]$y, [float]$width, [float]$height, [float]$radius) {
  $path = New-RoundedPath $x $y $width $height $radius
  try { $graphics.FillPath($brush, $path) } finally { $path.Dispose() }
}

function Draw-LineBlock($graphics, [float]$x, [float]$y, [float]$width, [Drawing.Color]$color) {
  $brush = [Drawing.SolidBrush]::new($color)
  try { Draw-RoundedRect $graphics $brush $x $y $width 8 4 } finally { $brush.Dispose() }
}

$output = [IO.Path]::GetFullPath($OutputDirectory)
if (-not (Test-Path -LiteralPath $output)) { New-Item -ItemType Directory -Path $output | Out-Null }
$icon = [Drawing.Image]::FromFile((Resolve-Path $ExtensionIcon).Path)

try {
  $small = New-Canvas 440 280
  $bitmap = $small.Bitmap
  $g = $small.Graphics
  try {
    $background = [Drawing.Drawing2D.LinearGradientBrush]::new([Drawing.Rectangle]::new(0,0,440,280), [Drawing.Color]::FromArgb(255,35,24,63), [Drawing.Color]::FromArgb(255,118,92,255), 32)
    $g.FillRectangle($background, 0, 0, 440, 280)
    $background.Dispose()

    $glow = [Drawing.SolidBrush]::new([Drawing.Color]::FromArgb(45,232,222,255))
    $g.FillEllipse($glow, 278, -92, 260, 260)
    $glow.Dispose()

    $cardBrush = [Drawing.SolidBrush]::new([Drawing.Color]::FromArgb(250,247,243,255))
    Draw-RoundedRect $g $cardBrush 286 68 116 116 28
    $cardBrush.Dispose()
    $g.DrawImage($icon, [Drawing.Rectangle]::new(296,78,96,96))

    $eyebrow = [Drawing.Font]::new("Segoe UI", 12, [Drawing.FontStyle]::Bold)
    $title = [Drawing.Font]::new("Segoe UI", 24, [Drawing.FontStyle]::Bold)
    $subtitle = [Drawing.Font]::new("Segoe UI", 11, [Drawing.FontStyle]::Bold)
    $white = [Drawing.SolidBrush]::new([Drawing.Color]::White)
    $lilac = [Drawing.SolidBrush]::new([Drawing.Color]::FromArgb(255,232,222,255))
    $g.DrawString("RUTRACKER", $eyebrow, $lilac, 34, 51)
    $g.DrawString("Visual Enhancer", $title, $white, 31, 91)
    $smallTagline = "Posters $([char]0x00B7) Filters $([char]0x00B7) Dark Mode"
    $g.DrawString($smallTagline, $subtitle, $lilac, 34, 145)

    $pillFont = [Drawing.Font]::new("Segoe UI", 9, [Drawing.FontStyle]::Bold)
    $pillBrush = [Drawing.SolidBrush]::new([Drawing.Color]::FromArgb(255,232,222,255))
    $pillText = [Drawing.SolidBrush]::new([Drawing.Color]::FromArgb(255,67,38,209))
    $labels = @(@("Faster",34,78),@("Clearer",122,78),@("Yours",210,72))
    foreach ($entry in $labels) {
      Draw-RoundedRect $g $pillBrush ([float]$entry[1]) 190 ([float]$entry[2]) 28 14
      $format = [Drawing.StringFormat]::new()
      $format.Alignment = [Drawing.StringAlignment]::Center
      $format.LineAlignment = [Drawing.StringAlignment]::Center
      $g.DrawString([string]$entry[0], $pillFont, $pillText, [Drawing.RectangleF]::new([float]$entry[1],190,[float]$entry[2],28), $format)
      $format.Dispose()
    }
    $eyebrow.Dispose(); $title.Dispose(); $subtitle.Dispose(); $pillFont.Dispose(); $white.Dispose(); $lilac.Dispose(); $pillBrush.Dispose(); $pillText.Dispose()
    $bitmap.Save((Join-Path $output "small-promo-440x280.png"), [Drawing.Imaging.ImageFormat]::Png)
  }
  finally { $g.Dispose(); $bitmap.Dispose() }

  $marquee = New-Canvas 1400 560
  $bitmap = $marquee.Bitmap
  $g = $marquee.Graphics
  try {
    $background = [Drawing.Drawing2D.LinearGradientBrush]::new([Drawing.Rectangle]::new(0,0,1400,560), [Drawing.Color]::FromArgb(255,23,16,34), [Drawing.Color]::FromArgb(255,91,61,245), 24)
    $g.FillRectangle($background, 0, 0, 1400, 560)
    $background.Dispose()
    $glow = [Drawing.SolidBrush]::new([Drawing.Color]::FromArgb(38,170,153,255))
    $g.FillEllipse($glow, 940, -250, 700, 700)
    $glow.Dispose()

    $iconCard = [Drawing.SolidBrush]::new([Drawing.Color]::FromArgb(250,247,243,255))
    Draw-RoundedRect $g $iconCard 90 86 112 112 28
    $iconCard.Dispose()
    $g.DrawImage($icon, [Drawing.Rectangle]::new(100,96,92,92))

    $eyebrow = [Drawing.Font]::new("Segoe UI", 14, [Drawing.FontStyle]::Bold)
    $title = [Drawing.Font]::new("Segoe UI", 39, [Drawing.FontStyle]::Bold)
    $subtitle = [Drawing.Font]::new("Segoe UI", 16, [Drawing.FontStyle]::Bold)
    $bodyFont = [Drawing.Font]::new("Segoe UI", 12, [Drawing.FontStyle]::Regular)
    $white = [Drawing.SolidBrush]::new([Drawing.Color]::White)
    $lilac = [Drawing.SolidBrush]::new([Drawing.Color]::FromArgb(255,232,222,255))
    $muted = [Drawing.SolidBrush]::new([Drawing.Color]::FromArgb(255,207,194,244))
    $g.DrawString("RUTRACKER", $eyebrow, $lilac, 90, 222)
    $g.DrawString("Visual Enhancer", $title, $white, 84, 260)
    $marqueeTagline = "Posters $([char]0x00B7) Filters $([char]0x00B7) Infinite Scroll $([char]0x00B7) Dark Mode"
    $g.DrawString($marqueeTagline, $subtitle, $lilac, 90, 334)
    $g.DrawString("A faster, clearer way to explore supported tracker results.", $bodyFont, $muted, 90, 382)

    $panel = [Drawing.SolidBrush]::new([Drawing.Color]::FromArgb(255,21,17,29))
    Draw-RoundedRect $g $panel 790 74 520 412 24
    $panel.Dispose()
    $toolbar = [Drawing.SolidBrush]::new([Drawing.Color]::FromArgb(255,40,32,57))
    Draw-RoundedRect $g $toolbar 808 92 484 52 14
    $toolbar.Dispose()
    $search = [Drawing.SolidBrush]::new([Drawing.Color]::FromArgb(255,23,18,31))
    Draw-RoundedRect $g $search 822 105 190 26 8
    $search.Dispose()
    $primary = [Drawing.SolidBrush]::new([Drawing.Color]::FromArgb(255,91,61,245))
    Draw-RoundedRect $g $primary 1028 105 88 26 9
    Draw-RoundedRect $g $primary 1184 105 92 26 9
    $primary.Dispose()
    $secondary = [Drawing.SolidBrush]::new([Drawing.Color]::FromArgb(255,128,107,255))
    Draw-RoundedRect $g $secondary 1128 105 46 26 9
    $secondary.Dispose()

    $rowColors = @([Drawing.Color]::FromArgb(255,33,27,43), [Drawing.Color]::FromArgb(255,28,23,37), [Drawing.Color]::FromArgb(255,33,27,43))
    for ($index = 0; $index -lt 3; $index++) {
      $rowY = 162 + ($index * 104)
      $rowBrush = [Drawing.SolidBrush]::new($rowColors[$index])
      Draw-RoundedRect $g $rowBrush 808 $rowY 484 92 12
      $rowBrush.Dispose()
      $posterBrush = [Drawing.SolidBrush]::new(@([Drawing.Color]::FromArgb(255,232,222,255),[Drawing.Color]::FromArgb(255,202,186,255),[Drawing.Color]::FromArgb(255,128,107,255))[$index])
      Draw-RoundedRect $g $posterBrush 820 ($rowY + 10) 58 72 7
      $posterBrush.Dispose()
      Draw-LineBlock $g 892 ($rowY + 17) (244 - ($index * 20)) ([Drawing.Color]::FromArgb(255,127,208,255))
      Draw-LineBlock $g 892 ($rowY + 38) (190 + ($index * 15)) ([Drawing.Color]::FromArgb(255,156,145,170))
      Draw-LineBlock $g 892 ($rowY + 55) (216 - ($index * 20)) ([Drawing.Color]::FromArgb(255,116,107,130))
      $action = [Drawing.SolidBrush]::new([Drawing.Color]::FromArgb(255,58,47,85))
      Draw-RoundedRect $g $action (1166 - ($index * 10)) ($rowY + 17) (100 + ($index * 10)) 24 8
      $action.Dispose()
    }

    $eyebrow.Dispose(); $title.Dispose(); $subtitle.Dispose(); $bodyFont.Dispose(); $white.Dispose(); $lilac.Dispose(); $muted.Dispose()
    $bitmap.Save((Join-Path $output "marquee-1400x560.png"), [Drawing.Imaging.ImageFormat]::Png)
  }
  finally { $g.Dispose(); $bitmap.Dispose() }

  Copy-Item -LiteralPath (Resolve-Path $ExtensionIcon).Path -Destination (Join-Path $output "store-icon-128.png") -Force
}
finally {
  $icon.Dispose()
}

Write-Output "Generated Chrome Web Store brand assets in $output"
