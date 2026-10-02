# Run from PowerShell on your computer. Password is entered locally, not in chat.
$ErrorActionPreference = 'Stop'
$projectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$pgBin = 'C:\Program Files\PostgreSQL\17\bin'
$psql = Join-Path $pgBin 'psql.exe'
$dump = Join-Path $pgBin 'pg_dump.exe'
$restore = Join-Path $pgBin 'pg_restore.exe'
$scratch = Join-Path $projectRoot 'tmp\database-move'
$envFile = Join-Path $projectRoot 'backend\.env'
foreach ($exe in @($psql, $dump, $restore)) {
    if (-not (Test-Path -LiteralPath $exe)) { throw "Required PostgreSQL tool missing: $exe" }
}
New-Item -ItemType Directory -Force -Path $scratch | Out-Null
$savedPassword = $env:PGPASSWORD
$savedEncoding = $env:PGCLIENTENCODING
$adminSecret = Read-Host 'Password for postgres on localhost:5432 (hidden)' -AsSecureString
$secretPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($adminSecret)
try {
    $env:PGPASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($secretPointer)
    $env:PGCLIENTENCODING = 'UTF8'
    function Invoke-TargetSql([string]$sql) {
        $result = $sql | & $psql -h localhost -p 5432 -U postgres -d postgres -w -X -v ON_ERROR_STOP=1 -t -A
        if ($LASTEXITCODE -ne 0) { throw 'Target SQL failed. No environment change has been made.' }
        return $result
    }
    $check = Invoke-TargetSql "SELECT current_user;"
    if ($check.Trim() -ne 'postgres') { throw 'Unexpected target user.' }
    $existing = Invoke-TargetSql "SELECT datname FROM pg_database WHERE datname IN ('shorturl','shorturl_test'); SELECT rolname FROM pg_roles WHERE rolname = 'shorturl_app';"
    if ($existing) { throw 'shorturl, shorturl_test or shorturl_app already exists on the target. Stopped without overwriting it.' }

    # Back up the source before any target mutation; source is left intact.
    $sourceDump = Join-Path $scratch 'shorturl-before-move.dump'
    & $dump -h 127.0.0.1 -p 55432 -U shorturl -d shorturl -w -Fc -f $sourceDump
    if ($LASTEXITCODE -ne 0) { throw 'Source backup failed. Check that the temporary PostgreSQL server is running.' }
    $sourceCount = & $psql -h 127.0.0.1 -p 55432 -U shorturl -d shorturl -w -X -t -A -c 'SELECT (SELECT COUNT(*) FROM links)::text || '','' || (SELECT COUNT(*) FROM click_events)::text;'
    if ($LASTEXITCODE -ne 0) { throw 'Could not read source record counts.' }

    $randomBytes = New-Object byte[] 24
    $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
    try { $rng.GetBytes($randomBytes) } finally { $rng.Dispose() }
    $appPassword = ([BitConverter]::ToString($randomBytes)).Replace('-', '').ToLowerInvariant()
    # Fixed role/database identifiers and generated hex password; no user SQL interpolation.
    Invoke-TargetSql "CREATE ROLE shorturl_app LOGIN PASSWORD '$appPassword';" | Out-Null
    Invoke-TargetSql 'CREATE DATABASE shorturl OWNER shorturl_app;' | Out-Null
    Invoke-TargetSql 'CREATE DATABASE shorturl_test OWNER shorturl_app;' | Out-Null
    & $restore -h localhost -p 5432 -U postgres -d shorturl -w --role=shorturl_app --no-owner --no-privileges --exit-on-error --single-transaction $sourceDump
    if ($LASTEXITCODE -ne 0) { throw 'Restore failed. Source and .env remain unchanged; target databases may have been created. Do not rerun blindly.' }

    # Confirm that the app's own role can read the restored data before switching it.
    $env:PGPASSWORD = $appPassword
    $targetCount = & $psql -h localhost -p 5432 -U shorturl_app -d shorturl -w -X -t -A -c 'SELECT (SELECT COUNT(*) FROM links)::text || '','' || (SELECT COUNT(*) FROM click_events)::text;'
    if ($LASTEXITCODE -ne 0 -or $targetCount.Trim() -ne $sourceCount.Trim()) {
        throw 'Target verification failed. Source and .env remain unchanged.'
    }
    Copy-Item -LiteralPath $envFile -Destination (Join-Path $scratch 'backend.env.before-move')
    $envContent = [IO.File]::ReadAllText($envFile)
    $envContent = [regex]::Replace($envContent, '(?m)^DATABASE_URL=.*$', "DATABASE_URL=postgresql://shorturl_app:${appPassword}@localhost:5432/shorturl")
    $envContent = [regex]::Replace($envContent, '(?m)^TEST_DATABASE_URL=.*$', "TEST_DATABASE_URL=postgresql://shorturl_app:${appPassword}@localhost:5432/shorturl_test")
    [IO.File]::WriteAllText($envFile, $envContent)
    Write-Host 'Moved successfully to PostgreSQL 17 at localhost:5432.'
    Write-Host 'Source database and other existing databases were not changed.'
    Write-Host 'Refresh Databases in pgAdmin, then restart the app with npm start.'
} finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($secretPointer)
    $adminSecret.Dispose()
    $env:PGPASSWORD = $savedPassword
    $env:PGCLIENTENCODING = $savedEncoding
    $appPassword = $null
}
