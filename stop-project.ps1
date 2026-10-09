$ErrorActionPreference = 'Stop'
$local = Join-Path $PSScriptRoot '.local'
foreach ($name in @('frontend', 'backend')) {
    $pidFile = Join-Path $local "$name.pid"
    if (Test-Path $pidFile) {
        $saved = Get-Content $pidFile | ConvertFrom-Json
        $process = Get-Process -Id $saved.id -ErrorAction SilentlyContinue
        if ($process -and $process.StartTime.ToUniversalTime().ToString('o') -eq $saved.started) {
            & taskkill.exe /PID $saved.id /T /F
            if ($LASTEXITCODE -ne 0) { throw "Could not stop $name." }
        }
        Remove-Item -LiteralPath $pidFile
    }
}
$pgCtl = Join-Path $local 'pgsql/bin/pg_ctl.exe'
$data = Join-Path $local 'pgdata'
if ((Test-Path -LiteralPath $pgCtl) -and (Test-Path -LiteralPath "$data/PG_VERSION")) {
    & $pgCtl status -D $data *> $null
    if ($LASTEXITCODE -eq 0) {
        & $pgCtl stop -D $data -m fast -w
        if ($LASTEXITCODE -ne 0) { throw 'Could not stop the project database.' }
    }
}
Write-Host 'Project stopped. Database data is preserved.'
