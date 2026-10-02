# Configure Supabase locally without putting a database password in chat or command history.
$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$envPath = Join-Path $projectRoot 'backend\.env'
if (-not (Test-Path -LiteralPath $envPath)) { throw 'backend/.env is missing. Copy backend/.env.example first.' }
$template = (Read-Host 'Paste Session pooler URI with [YOUR-PASSWORD] still in it').Trim()
if ([regex]::Matches($template, '\[YOUR-PASSWORD\]').Count -ne 1) {
    throw 'Copy the URI with exactly one [YOUR-PASSWORD] placeholder. Do not paste the actual password here.'
}
$checkUri = [Uri]($template.Replace('[YOUR-PASSWORD]', 'placeholder'))
if ($checkUri.Scheme -notin @('postgresql', 'postgres') -or
    -not $checkUri.Host.EndsWith('.pooler.supabase.com') -or
    $checkUri.Port -ne 5432 -or $checkUri.AbsolutePath -ne '/postgres' -or $checkUri.Query -or $checkUri.Fragment) {
    throw 'Expected a Supabase Session pooler URI on port 5432, database postgres, without query parameters.'
}
$secret = Read-Host 'Database password (hidden)' -AsSecureString
if ($secret.Length -eq 0) { $secret.Dispose(); throw 'Password cannot be empty.' }
$pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secret)
try {
    $encodedPassword = [Uri]::EscapeDataString([Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer))
    $connection = $template.Replace('[YOUR-PASSWORD]', $encodedPassword)
    $lines = [IO.File]::ReadAllLines($envPath)
    $backupDir = Join-Path $projectRoot 'tmp\supabase-setup'
    New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
    $backup = Join-Path $backupDir ('backend.env.before-supabase-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.txt')
    Copy-Item -LiteralPath $envPath -Destination $backup
    $newLines = New-Object 'System.Collections.Generic.List[string]'
    $hasUrl = $false
    $hasSsl = $false
    foreach ($line in $lines) {
        if ($line -match '^DATABASE_URL=') { $newLines.Add('DATABASE_URL=' + $connection); $hasUrl = $true }
        elseif ($line -match '^DATABASE_SSL=') { $newLines.Add('DATABASE_SSL=true'); $hasSsl = $true }
        else { $newLines.Add($line) }
    }
    if (-not $hasUrl) { $newLines.Add('DATABASE_URL=' + $connection) }
    if (-not $hasSsl) { $newLines.Add('DATABASE_SSL=true') }
    [IO.File]::WriteAllLines($envPath, $newLines, (New-Object Text.UTF8Encoding($false)))
    Write-Host 'Saved backend/.env with Supabase connection and TLS enabled.'
    Write-Host 'TEST_DATABASE_URL and PUBLIC_BASE_URL are unchanged. Old environment is backed up under tmp/supabase-setup.'
    Write-Host 'This only configures the connection; migration and connectivity still need to be verified.'
} finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
    $secret.Dispose()
    $encodedPassword = $null
    $connection = $null
}
