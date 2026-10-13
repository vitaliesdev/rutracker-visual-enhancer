param(
  [string]$KitDirectory = $PSScriptRoot,
  [string]$WebsiteDirectory = (Join-Path $PSScriptRoot "..\docs"),
  [string]$ExtensionZip = ""
)

$ErrorActionPreference = "Stop"
$repoRoot = Join-Path $PSScriptRoot ".."
$expectedVersion = (Get-Content -Raw -LiteralPath (Join-Path $repoRoot "extension\manifest.json") | ConvertFrom-Json).version
if (-not $ExtensionZip) {
  # Default to the zip that `npm run build` produces for the current manifest version.
  $ExtensionZip = Join-Path $repoRoot "dist\rutracker-visual-enhancer-v$expectedVersion.zip"
}
Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.IO.Compression.FileSystem

$errors = [Collections.Generic.List[string]]::new()
$warnings = [Collections.Generic.List[string]]::new()

function Assert-File([string]$relativePath) {
  $path = Join-Path $KitDirectory $relativePath
  if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
    $errors.Add("Missing required file: $relativePath")
  }
  return $path
}

function Assert-ImageSize([string]$relativePath, [int]$expectedWidth, [int]$expectedHeight) {
  $path = Assert-File $relativePath
  if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { return }
  $image = [Drawing.Image]::FromFile((Resolve-Path -LiteralPath $path).Path)
  try {
    if ($image.Width -ne $expectedWidth -or $image.Height -ne $expectedHeight) {
      $errors.Add("Wrong dimensions for ${relativePath}: $($image.Width)x$($image.Height), expected ${expectedWidth}x${expectedHeight}")
    }
  }
  finally { $image.Dispose() }
}

$requiredFiles = @(
  "PUBLISHING-CHECKLIST.md",
  "STORE-LISTING.md",
  "PRIVACY-DASHBOARD.md",
  "REVIEWER-NOTES.md",
  "SCREENSHOTS.md"
)
foreach ($file in $requiredFiles) { [void](Assert-File $file) }
foreach ($file in @("index.html", "privacy.html", "support.html", "styles.css")) {
  if (-not (Test-Path -LiteralPath (Join-Path $WebsiteDirectory $file) -PathType Leaf)) {
    $errors.Add("Missing required website file: docs\$file")
  }
}

Assert-ImageSize "assets\store-icon-128.png" 128 128
Assert-ImageSize "assets\small-promo-440x280.png" 440 280
Assert-ImageSize "assets\marquee-1400x560.png" 1400 560

if (-not (Test-Path -LiteralPath $ExtensionZip -PathType Leaf)) {
  $errors.Add("Extension ZIP not found: $ExtensionZip")
}
else {
  $archive = [IO.Compression.ZipFile]::OpenRead((Resolve-Path -LiteralPath $ExtensionZip).Path)
  try {
    $manifestEntry = $archive.Entries | Where-Object { $_.FullName -eq "manifest.json" } | Select-Object -First 1
    if (-not $manifestEntry) {
      $errors.Add("The extension ZIP does not contain manifest.json at its root")
    }
    else {
      $reader = [IO.StreamReader]::new($manifestEntry.Open(), [Text.Encoding]::UTF8)
      try { $manifest = ($reader.ReadToEnd() | ConvertFrom-Json) } finally { $reader.Dispose() }
      if ($manifest.manifest_version -ne 3) { $errors.Add("manifest_version must be 3") }
      if ($manifest.version -ne $expectedVersion) { $errors.Add("ZIP manifest version is $($manifest.version), but extension\manifest.json is $expectedVersion; run npm run build") }
      if ($manifest.default_locale -ne "en") { $warnings.Add("The default locale is not English") }

      $manifestText = $manifest | ConvertTo-Json -Depth 10
      foreach ($siteHost in @("rutracker.org")) {
        if ($manifestText -notmatch [Regex]::Escape($siteHost)) {
          $warnings.Add("Expected supported host is absent from the manifest: $siteHost")
        }
      }
    }
  }
  finally { $archive.Dispose() }
}

$listingPath = Join-Path $KitDirectory "STORE-LISTING.md"
if (Test-Path -LiteralPath $listingPath) {
  $listing = [IO.File]::ReadAllText((Resolve-Path -LiteralPath $listingPath), [Text.Encoding]::UTF8)
  foreach ($locale in @("## English", "## Ukrainian", "## Russian", "## Romanian", "## Spanish")) {
    if (-not $listing.Contains($locale)) { $errors.Add("Store listing is missing locale: $locale") }
  }
  if (-not $listing.Contains("RuTracker Visual Enhancer - Posters, Filters & Dark Mode")) {
    $errors.Add("Store listing is missing the exact product name")
  }
}

$placeholderMatches = Get-ChildItem -LiteralPath $WebsiteDirectory -File |
  Select-String -SimpleMatch "REPLACE_WITH_CONTACT_EMAIL"
if ($placeholderMatches) {
  $warnings.Add("Replace REPLACE_WITH_CONTACT_EMAIL in docs/privacy.html and docs/support.html before hosting")
}

$screenshots = Get-ChildItem -LiteralPath (Join-Path $KitDirectory "screenshots") -Filter "*.png" -File -ErrorAction SilentlyContinue
if (-not $screenshots) {
  $warnings.Add("No real Store screenshots are present. Capture at least one from the exact installed $expectedVersion build")
}

$warnings.Add("The submitted manifest includes direct .torrent and Magnet actions; review the policy section before submission")

Write-Host "Chrome Web Store publishing-kit validation"
Write-Host "Errors: $($errors.Count)"
foreach ($item in $errors) { Write-Host "  ERROR: $item" -ForegroundColor Red }
Write-Host "Warnings: $($warnings.Count)"
foreach ($item in $warnings) { Write-Host "  WARNING: $item" -ForegroundColor Yellow }

if ($errors.Count -gt 0) { exit 1 }
Write-Host "Validation passed; resolve the warnings before submitting." -ForegroundColor Green
