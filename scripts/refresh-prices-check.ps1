<#
.SYNOPSIS
  One-shot local trigger + verification for the refresh-prices cron route.

.DESCRIPTION
  Replaces the manual multi-command PowerShell sequence used throughout
  this session (find CRON_SECRET -> build header -> curl -> eyeball JSON)
  with a single script. Never prints CRON_SECRET's value anywhere - only
  whether it was found and in which file, consistent with this session's
  standing rule of not transmitting credential values through Claude.

  What it does:
    1. Searches, in order, .env.production.local, .env.local, .env,
       .env.development.local for a CRON_SECRET= line (first match wins,
       matching Next.js's own env-file precedence for production-like
       values). Strips surrounding quotes and whitespace.
    2. If nothing found in any file, prints exactly which files exist and
       which don't, and stops - no request is sent with an empty/blank
       secret (that's what produced the confusing "Unauthorized" earlier;
       this refuses to repeat that failure mode silently).
    3. Calls the refresh-prices endpoint with the Bearer header built from
       the found secret.
    4. Writes the full raw JSON response to
       scratch/refresh-prices-<timestamp>.json (creates scratch/ if
       missing) AND pretty-prints it to the console, so you can just paste
       the console output back without hunting for a file.
    5. Prints a short summary line per partner (matched/upserted/errors
       count) at the very top, before the full JSON, so the headline
       result is visible without scrolling.

.PARAMETER Url
  Override the refresh-prices endpoint. Defaults to the URL used
  throughout this session.

.EXAMPLE
  .\scripts\refresh-prices-check.ps1
#>

param(
    [string]$Url = "https://pricefinder-phi.vercel.app/api/cron/refresh-prices"
)

$ErrorActionPreference = "Stop"

# Next.js precedence-ish order: most-specific/production-like files first.
$candidateFiles = @(
    ".env.production.local",
    ".env.local",
    ".env",
    ".env.development.local"
)

$cronSecret = $null
$foundIn = $null

foreach ($f in $candidateFiles) {
    if (-not (Test-Path $f)) {
        Write-Host "  $f : not present"
        continue
    }

    $content = Get-Content $f -Raw
    $match = [regex]::Match($content, '(?m)^\s*CRON_SECRET\s*=\s*(.+?)\s*$')

    if (-not $match.Success) {
        Write-Host "  $f : present, no CRON_SECRET line"
        continue
    }

    $raw = $match.Groups[1].Value.Trim()
    # Strip one layer of surrounding quotes if present (common paste artifact).
    if (($raw.StartsWith('"') -and $raw.EndsWith('"')) -or
        ($raw.StartsWith("'") -and $raw.EndsWith("'"))) {
        $raw = $raw.Substring(1, $raw.Length - 2)
    }

    if ($raw.Length -eq 0) {
        Write-Host "  $f : CRON_SECRET line found but value is empty"
        continue
    }

    Write-Host "  $f : CRON_SECRET found (length $($raw.Length))"
    $cronSecret = $raw
    $foundIn = $f
    break
}

if (-not $cronSecret) {
    Write-Host ""
    Write-Host "CRON_SECRET not found in any of: $($candidateFiles -join ', ')" -ForegroundColor Red
    Write-Host "Add it to one of those files (matching whatever value is set in the Vercel dashboard" -ForegroundColor Red
    Write-Host "under Settings -> Environment Variables -> CRON_SECRET) and re-run this script." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Using CRON_SECRET from $foundIn -> calling $Url ..."
Write-Host ""

$headers = @{ Authorization = "Bearer $cronSecret" }

try {
    $rawResponse = Invoke-WebRequest -Uri $Url -Headers $headers -Method Get -UseBasicParsing
    $statusCode = $rawResponse.StatusCode
    $bodyText = $rawResponse.Content
} catch {
    # Invoke-WebRequest throws on non-2xx; still capture body + status for diagnosis.
    $statusCode = $_.Exception.Response.StatusCode.value__
    $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
    $bodyText = $reader.ReadToEnd()
}

Write-Host "HTTP status: $statusCode"
Write-Host ""

if ($statusCode -eq 401) {
    Write-Host "Still Unauthorized. This means the CRON_SECRET found locally in $foundIn" -ForegroundColor Red
    Write-Host "does NOT match the CRON_SECRET set in the Vercel dashboard's production" -ForegroundColor Red
    Write-Host "environment variables. Compare the two values yourself (don't paste either" -ForegroundColor Red
    Write-Host "one back here) and update whichever is stale." -ForegroundColor Red
    Write-Host ""
    Write-Host $bodyText
    exit 1
}

$parsed = $null
try {
    $parsed = $bodyText | ConvertFrom-Json
} catch {
    Write-Host "Response was not valid JSON - printing raw body:" -ForegroundColor Yellow
    Write-Host $bodyText
    exit 1
}

# Save the full raw response to scratch/ for the record.
$scratchDir = "scratch"
if (-not (Test-Path $scratchDir)) {
    New-Item -ItemType Directory -Path $scratchDir | Out-Null
}
$timestamp = (Get-Date).ToString("yyyy-MM-dd_HHmmss")
$outFile = Join-Path $scratchDir "refresh-prices-$timestamp.json"
$bodyText | Out-File -FilePath $outFile -Encoding utf8
Write-Host "Full response saved to $outFile"
Write-Host ""

# Short per-partner summary line, printed before the full JSON dump.
Write-Host "--- Per-partner summary ---"
if ($parsed.partners) {
    foreach ($p in $parsed.partners) {
        if ($p.skipped) {
            Write-Host ("{0,-16} SKIPPED: {1}" -f $p.partnerId, $p.skipped)
        } else {
            $errCount = if ($p.errors) { $p.errors.Count } else { 0 }
            Write-Host ("{0,-16} feedRows={1,-5} matched={2,-5} upserted={3,-5} matchedById={4,-5} matchedByName={5,-5} errors={6}" -f `
                $p.partnerId, $p.feedRows, $p.matched, $p.upserted, $p.matchedById, $p.matchedByName, $errCount)
            if ($errCount -gt 0) {
                foreach ($e in $p.errors) { Write-Host ("    ! {0}" -f $e) -ForegroundColor Yellow }
            }
        }
    }
} else {
    Write-Host "(no partners field found in response - printing full JSON below)"
}

Write-Host ""
Write-Host "--- Full JSON response ---"
Write-Host ($parsed | ConvertTo-Json -Depth 10)
