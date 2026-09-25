$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$local = Join-Path $root '.local'
$nodeDir = Join-Path $local 'node-v22.23.3-win-x64'
$node = Join-Path $nodeDir 'node.exe'
$pgCtl = Join-Path $local 'pgsql/bin/pg_ctl.exe'
$data = Join-Path $local 'pgdata'
$env:Path = "$nodeDir;$env:Path"

foreach ($required in @($node, $pgCtl, "$data/PG_VERSION", "$root/ims-backend/.env", "$root/ims-backend/dist/src/main.js", "$root/ims-frontend/.next/BUILD_ID")) {
    if (!(Test-Path -LiteralPath $required)) { throw "Setup incomplete: missing $required" }
}

& $pgCtl status -D $data *> $null
if ($LASTEXITCODE -ne 0) {
    & $pgCtl start -D $data -l "$local/postgres.log" -w
    if ($LASTEXITCODE -ne 0) { throw 'Database failed to start. See .local/postgres.log.' }
}

function Start-App($name, $directory, $arguments, $port) {
    $pidFile = Join-Path $local "$name.pid"
    if (Test-Path $pidFile) {
        $saved = Get-Content $pidFile | ConvertFrom-Json
        $running = Get-Process -Id $saved.id -ErrorAction SilentlyContinue
        if ($running -and $running.StartTime.ToUniversalTime().ToString('o') -eq $saved.started) {
            Write-Host "$name is already running."
            return
        }
    }
    $probe = New-Object Net.Sockets.TcpClient
    try {
        $probe.Connect('127.0.0.1', $port)
        throw "Port $port is already occupied. Stop the application using it before starting $name."
    } catch [Net.Sockets.SocketException] {
        # An unused port is expected.
    } finally { $probe.Dispose() }
    $process = Start-Process -FilePath $node -ArgumentList $arguments -WorkingDirectory $directory -WindowStyle Hidden -RedirectStandardOutput "$local/$name.log" -RedirectStandardError "$local/$name-error.log" -PassThru
    @{ id = $process.Id; started = $process.StartTime.ToUniversalTime().ToString('o') } | ConvertTo-Json | Set-Content $pidFile
    Write-Host "Started $name (PID $($process.Id))."
}

Start-App 'backend' "$root/ims-backend" 'dist/src/main.js' 4000
Start-App 'frontend' "$root/ims-frontend" 'node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3000' 3000
Write-Host 'Open http://localhost:3000 after the frontend finishes starting. Logs are in .local.'
