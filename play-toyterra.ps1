param(
  [int]$Port = 5174
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$site = Join-Path $root "toyterra-dist"

if (-not (Test-Path (Join-Path $site "index.html"))) {
  Write-Host "Toyterra needs to be built first. Run: npm install; npm run build"
  exit 1
}

$prefix = "http://localhost:$Port/"
$listener = [System.Net.HttpListener]::new()
$listener.Prefixes.Add($prefix)

try {
  $listener.Start()
} catch {
  Write-Host "Could not start on $prefix"
  Write-Host "Try another port, for example: .\play-toyterra.ps1 -Port 5180"
  exit 1
}

Write-Host ""
Write-Host "Toyterra is running:"
Write-Host $prefix
Write-Host ""
Write-Host "Press Ctrl+C in this window when you are done playing."
Write-Host ""

Start-Process $prefix

$mimeTypes = @{
  ".html" = "text/html; charset=utf-8"
  ".js" = "text/javascript; charset=utf-8"
  ".css" = "text/css; charset=utf-8"
  ".svg" = "image/svg+xml"
  ".png" = "image/png"
  ".jpg" = "image/jpeg"
  ".jpeg" = "image/jpeg"
}

try {
  while ($listener.IsListening) {
    $context = $listener.GetContext()
    $requestPath = [System.Uri]::UnescapeDataString($context.Request.Url.AbsolutePath)

    if ($requestPath -eq "/") {
      $requestPath = "/index.html"
    }

    $relativePath = $requestPath.TrimStart("/").Replace("/", [System.IO.Path]::DirectorySeparatorChar)
    $filePath = Join-Path $site $relativePath
    $fullSite = [System.IO.Path]::GetFullPath($site)
    $fullFile = [System.IO.Path]::GetFullPath($filePath)

    if (-not $fullFile.StartsWith($fullSite)) {
      $context.Response.StatusCode = 403
      $context.Response.Close()
      continue
    }

    if (-not (Test-Path $fullFile)) {
      $context.Response.StatusCode = 404
      $context.Response.Close()
      continue
    }

    $bytes = [System.IO.File]::ReadAllBytes($fullFile)
    $extension = [System.IO.Path]::GetExtension($fullFile).ToLowerInvariant()
    $context.Response.ContentType = $mimeTypes[$extension]
    if (-not $context.Response.ContentType) {
      $context.Response.ContentType = "application/octet-stream"
    }

    $context.Response.ContentLength64 = $bytes.Length
    $context.Response.OutputStream.Write($bytes, 0, $bytes.Length)
    $context.Response.Close()
  }
} finally {
  $listener.Stop()
}
