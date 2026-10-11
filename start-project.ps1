param([switch]$BackendOnly)

$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$local = Join-Path $root '.local'
$nodeDir = Join-Path $local 'node-v22.23.3-win-x64'
$node = Join-Path $nodeDir 'node.exe'
if (!(Test-Path -LiteralPath $node)) {
    $node = (Get-Command node.exe -ErrorAction Stop).Source
}
$pgCtl = Join-Path $local 'pgsql/bin/pg_ctl.exe'
$data = Join-Path $local 'pgdata'
$env:Path = "$nodeDir;$env:Path"

$requiredFiles = @($node, "$root/ims-backend/.env", "$root/ims-backend/dist/src/main.js")
if (!$BackendOnly) { $requiredFiles += "$root/ims-frontend/.next/BUILD_ID" }
foreach ($required in $requiredFiles) {
    if (!(Test-Path -LiteralPath $required)) { throw "Setup incomplete: missing $required" }
}

New-Item -ItemType Directory -Path $local -Force | Out-Null
if ((Test-Path -LiteralPath $pgCtl) -and (Test-Path -LiteralPath "$data/PG_VERSION")) {
    & $pgCtl status -D $data *> $null
    if ($LASTEXITCODE -ne 0) {
        # Recovery after an interrupted shutdown can exceed pg_ctl's 60-second default.
        & $pgCtl start -D $data -l "$local/postgres.log" -w -t 180
        if ($LASTEXITCODE -ne 0) { throw 'Database failed to start. See .local/postgres.log.' }
    }
} else {
    Write-Host 'Using PostgreSQL configured in ims-backend/.env. Its service must be running.'
}

function Wait-AppReady($name, $port, $process = $null) {
    $deadline = [DateTime]::UtcNow.AddSeconds(45)
    do {
        if ($process) {
            $process.Refresh()
            if ($process.HasExited) {
                throw "$name exited during startup. See .local/$name-error.log."
            }
        }
        $probe = New-Object Net.Sockets.TcpClient
        try {
            $connection = $probe.ConnectAsync('127.0.0.1', $port)
            if ($connection.Wait(500) -and $probe.Connected) { return }
        } catch {
            # Retry while the application is initializing.
        } finally { $probe.Dispose() }
        Start-Sleep -Milliseconds 500
    } while ([DateTime]::UtcNow -lt $deadline)
    throw "$name did not become ready on port $port. See .local/$name.log and .local/$name-error.log."
}

function Start-App($name, $directory, $arguments, $port) {
    $pidFile = Join-Path $local "$name.pid"
    if (Test-Path $pidFile) {
        $saved = Get-Content $pidFile | ConvertFrom-Json
        $running = Get-Process -Id $saved.id -ErrorAction SilentlyContinue
        if ($running -and $running.StartTime.ToUniversalTime().ToString('o') -eq $saved.started) {
            Wait-AppReady $name $port $running
            Write-Host "$name is already running."
            return
        }
    }
    $probe = New-Object Net.Sockets.TcpClient
    try {
        $probe.Connect('127.0.0.1', $port)
        if ($name -eq 'backend') {
            try {
                $response = Invoke-WebRequest -Uri "http://127.0.0.1:$port/auth/me" -UseBasicParsing -TimeoutSec 5
                $status = [int]$response.StatusCode
            } catch {
                if (!$_.Exception.Response) { throw }
                $status = [int]$_.Exception.Response.StatusCode
            }
            if ($status -eq 200 -or $status -eq 401) {
                Write-Host 'backend is already responding.'
                return
            }
        }
        throw "Port $port is already occupied. Stop the application using it before starting $name."
    } catch [Net.Sockets.SocketException] {
        # An unused port is expected.
    } finally { $probe.Dispose() }
    $process = Start-Process -FilePath $node -ArgumentList $arguments -WorkingDirectory $directory -WindowStyle Hidden -RedirectStandardOutput "$local/$name.log" -RedirectStandardError "$local/$name-error.log" -PassThru
    @{ id = $process.Id; started = $process.StartTime.ToUniversalTime().ToString('o') } | ConvertTo-Json | Set-Content $pidFile
    Wait-AppReady $name $port $process
    Write-Host "Started $name (PID $($process.Id))."
}

Start-App 'backend' "$root/ims-backend" 'dist/src/main.js' 4000
if ($BackendOnly) {
    Write-Host 'Database and backend started. Logs are in .local.'
    return
}
Start-App 'frontend' "$root/ims-frontend" 'node_modules/next/dist/bin/next start --hostname 0.0.0.0 --port 3000' 3000
Write-Host 'Open http://localhost:3000 after the frontend finishes starting. Logs are in .local.'
