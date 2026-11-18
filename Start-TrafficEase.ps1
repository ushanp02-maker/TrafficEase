#Requires -Version 5.1
<# One local launcher. -Simulation runs without external map/weather/routing services.
   Dependencies: JDK 17, Maven 3.9+, Node 22.12+, Python 3.12 (py launcher or PATH).
   No administrator rights, AWS, default passwords or paid services required. #>
[CmdletBinding()]
param([switch]$Simulation,[switch]$NoBrowser,[switch]$SkipInstall,[switch]$Stop)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version 2
$repo = $PSScriptRoot
$run = Join-Path $repo '.local-run'
$stateFile = Join-Path $run 'processes.json'
$isWindowsHost = $env:OS -eq 'Windows_NT'

function Quote-PS([string]$Value) { return "'" + $Value.Replace("'", "''") + "'" }
function Stop-Owned {
    if (!(Test-Path $stateFile)) { return }
    foreach ($entry in @(Get-Content $stateFile -Raw | ConvertFrom-Json)) {
        $process = Get-Process -Id $entry.id -ErrorAction SilentlyContinue
        if ($null -eq $process) { continue }
        if (!$isWindowsHost -and (Test-Path "/proc/$($entry.id)/stat")) {
            if ((Get-Content "/proc/$($entry.id)/stat" -Raw) -match '^\d+ \(.+\) Z ') { continue }
        }
        $actualExe=$process.Path
        if (!$isWindowsHost -and (Test-Path "/proc/$($entry.id)/cmdline")) {
            $actualExe=([IO.File]::ReadAllText("/proc/$($entry.id)/cmdline").Split([char]0))[0]
        }
        if ([math]::Abs($process.StartTime.ToUniversalTime().Ticks - [long]$entry.started) -gt 1000000 -or $process.ProcessName -notmatch '^(powershell|pwsh)$' -or (($entry.PSObject.Properties.Name -contains 'executable') -and $actualExe -ne $entry.executable)) { throw 'Saved process ID was reused. Refusing to stop an unrelated process.' }
        if ($isWindowsHost) { & taskkill.exe /PID $entry.id /T /F *> $null }
        else {
            # Child PowerShell launches the service as its descendant. Stop descendants first.
            function Stop-Children([int]$TaskId) {
                $childIds=@(& pgrep -P $TaskId 2>$null)
                foreach ($childId in $childIds) { if ($childId -match '^\d+$') { Stop-Children ([int]$childId) } }
                Stop-Process -Id $TaskId -Force -ErrorAction SilentlyContinue
            }
            Stop-Children ([int]$entry.id)
        }
    }
    Remove-Item $stateFile -Force
}
if ($Stop) { Stop-Owned; Write-Host 'TrafficEase stopped.'; return }
if (Test-Path $stateFile) { throw 'TrafficEase has a saved session. Run this script with -Stop before starting again.' }
New-Item -ItemType Directory -Force $run | Out-Null
$setupLog = Join-Path $run 'setup.log'
'Preparing TrafficEase' | Set-Content $setupLog
function Tool([string]$Name) { $command=Get-Command $Name -ErrorAction SilentlyContinue; if (!$command) { throw "Install $Name and reopen PowerShell, then try again." }; return $command.Source }
function Version-Text([string]$Exe,[string[]]$Arguments) { $ErrorActionPreference='Continue'; return (& $Exe @Arguments 2>&1 | Out-String) }
function Checked([string]$Exe,[string[]]$Arguments) {
    $old=$ErrorActionPreference
    try { $ErrorActionPreference='Continue'; & $Exe @Arguments >> $setupLog 2>&1; $code=$LASTEXITCODE }
    finally { $ErrorActionPreference=$old }
    if ($code -ne 0) { throw "Preparation failed. See $setupLog" }
}
function Wait-Ready([string]$Url,[scriptblock]$Validate,[int]$Seconds=90) {
    $deadline=(Get-Date).AddSeconds($Seconds)
    while ((Get-Date) -lt $deadline) {
        try { $body=Invoke-RestMethod -Uri $Url -TimeoutSec 3; if (& $Validate $body) { return } } catch { }
        Start-Sleep -Milliseconds 500
    }
    throw "A service did not become ready. Check logs in $run"
}
# Refuse to attach to or terminate unrelated existing services.
foreach ($port in @(5173,8080,8000)) {
    $client=New-Object System.Net.Sockets.TcpClient
    try { $task=$client.ConnectAsync('127.0.0.1',$port); if ($task.Wait(300) -and $client.Connected) { throw "Port $port is already in use. Stop that application first." } }
    catch [System.AggregateException] { }
    finally { $client.Dispose() }
}
$java=Tool 'java'; $javac=Tool 'javac'
if ($env:JAVA_HOME) {
    $suffix=''; if ($isWindowsHost) { $suffix='.exe' }
    $java=Join-Path $env:JAVA_HOME "bin/java$suffix"; $javac=Join-Path $env:JAVA_HOME "bin/javac$suffix"
}
if ((Version-Text $java @('-version')) -notmatch 'version "17\.' -or (Version-Text $javac @('-version')) -notmatch 'javac 17\.') { throw 'Set JAVA_HOME and PATH to a complete JDK 17 installation.' }
$node=Tool 'node'; $npmName='npm'; $mvnName='mvn'; if ($isWindowsHost) { $npmName='npm.cmd'; $mvnName='mvn.cmd' }
$npm=Tool $npmName; $mvn=Tool $mvnName
$nodeVersion=(& $node -p 'JSON.stringify(process.versions.node.split(".").map(Number))' | ConvertFrom-Json)
if ($nodeVersion[0] -lt 22 -or ($nodeVersion[0] -eq 22 -and $nodeVersion[1] -lt 12)) { throw 'Install Node.js 22.12 or newer.' }
$pythonArgs=@(); $py=Get-Command 'py.exe' -ErrorAction SilentlyContinue
if ($isWindowsHost -and $py) { $python=$py.Source; $pythonArgs=@('-3.12') }
elseif (Get-Command 'python3.12' -ErrorAction SilentlyContinue) { $python=Tool 'python3.12' }
else { $python=Tool 'python' }
$pythonVersion=Version-Text $python ($pythonArgs+@('--version'))
if ($pythonVersion -notmatch 'Python 3\.12\.') { throw 'Install Python 3.12 and ensure it is available through py -3.12 or PATH.' }
$venvPython=Join-Path $repo 'ai-service/.venv/bin/python'
if ($isWindowsHost) { $venvPython=Join-Path $repo 'ai-service/.venv/Scripts/python.exe' }
Push-Location $repo
$owned=@()
try {
    Write-Host 'Preparing dependencies and checking both traffic models...'
    if (!$SkipInstall) {
        if (!(Test-Path $venvPython)) { Checked $python ($pythonArgs+@('-m','venv',(Join-Path $repo 'ai-service/.venv'))) }
        Checked $venvPython @('-m','pip','install','-r',(Join-Path $repo 'ai-service/requirements.lock.txt'))
        $lockHash=(Get-FileHash (Join-Path $repo 'frontend/package-lock.json') -Algorithm SHA256).Hash
        $marker=Join-Path $run 'npm-lock.sha256'
        if (!(Test-Path (Join-Path $repo 'frontend/node_modules')) -or !(Test-Path $marker) -or (Get-Content $marker -Raw).Trim() -ne $lockHash) {
            Checked $npm @('ci','--prefix',(Join-Path $repo 'frontend'),'--no-audit','--no-fund'); Set-Content $marker $lockHash
        }
    }
    if (!(Test-Path $venvPython) -or !(Test-Path (Join-Path $repo 'frontend/node_modules'))) { throw 'Dependencies are missing. Run without -SkipInstall first.' }
    $env:MODEL_DIR=Join-Path $repo 'ai-service/artifacts'
    Checked $venvPython @((Join-Path $repo 'ai-service/prepare_models.py'))
    Write-Host 'Building the Java 17 backend...'
    Checked $mvn @('-f',(Join-Path $repo 'backend/pom.xml'),'-B','-DskipTests','package')
    # Use a run-specific JAR, so later builds cannot alter a running Java classpath.
    $jar=Join-Path $run ('backend-'+[guid]::NewGuid().ToString('N')+'.jar')
    Copy-Item (Join-Path $repo 'backend/target/trafficease-backend-0.1.0-SNAPSHOT.jar') $jar
    $shell=(Get-Process -Id $PID).Path
    function Start-ServiceProcess([string]$Name,[string]$WorkingDirectory,[string]$Exe,[string[]]$Arguments,[hashtable]$Variables) {
        $text="Set-Location -LiteralPath $(Quote-PS $WorkingDirectory); "
        foreach ($key in $Variables.Keys) { $text += "`$env:$key=$(Quote-PS $Variables[$key]); " }
        $text += '& '+(Quote-PS $Exe)+' '+(($Arguments | ForEach-Object { Quote-PS $_ }) -join ' ')+'; exit $LASTEXITCODE'
        $encoded=[Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($text))
        $options=@{FilePath=$shell;ArgumentList=@('-NoProfile','-NonInteractive','-EncodedCommand',$encoded);PassThru=$true;RedirectStandardOutput=(Join-Path $run "$Name.log");RedirectStandardError=(Join-Path $run "$Name.err.log")}
        if ($isWindowsHost) { $options.WindowStyle='Hidden' }
        $process=Start-Process @options
        return [pscustomobject]@{id=$process.Id;started=$process.StartTime.ToUniversalTime().Ticks.ToString();name=$Name;executable=$shell}
    }
    $owned+=Start-ServiceProcess 'ai' (Join-Path $repo 'ai-service') $venvPython @('-m','uvicorn','main:app','--host','127.0.0.1','--port','8000') @{}
    $owned | ConvertTo-Json | Set-Content $stateFile
    Wait-Ready 'http://127.0.0.1:8000/health' { param($data) $data.model_status -eq 'ready' }
    Wait-Ready 'http://127.0.0.1:8000/route-model' { param($data) $data.modelStatus -eq 'ready' }
    $owned+=Start-ServiceProcess 'backend' $repo $java @('-jar',$jar) @{SERVER_ADDRESS='127.0.0.1';AI_SERVICE_URL='http://127.0.0.1:8000'}
    $owned | ConvertTo-Json | Set-Content $stateFile
    Wait-Ready 'http://127.0.0.1:8080/api/health' { param($data) $data.status -eq 'ok' }
    Write-Host 'Checking actual inference for both models and all 30 journeys...'
    Checked $venvPython @((Join-Path $repo 'scripts/check_app.py'))
    $demo='false'; if ($Simulation) { $demo='true' }
    $owned+=Start-ServiceProcess 'frontend' (Join-Path $repo 'frontend') $node @((Join-Path $repo 'frontend/node_modules/vite/bin/vite.js'),'--host','0.0.0.0','--port','5173','--strictPort') @{VITE_DEMO_MODE=$demo;BACKEND_PROXY_TARGET='http://127.0.0.1:8080';CI='true'}
    $owned | ConvertTo-Json | Set-Content $stateFile
    $siteUrl='http://localhost:5173'
    if ($env:DEV_HTTPS_CERT -or $env:DEV_HTTPS_KEY) { $siteUrl='https://localhost:5173' }
    Wait-Ready ($siteUrl+'/api/health') { param($data) $data.status -eq 'ok' }
    Write-Host "TrafficEase is ready: $siteUrl"
    Write-Host 'Both models and all 30 simulation journeys passed. Stop with: .\Start-TrafficEase.ps1 -Stop'
    if (!$NoBrowser) { Start-Process $siteUrl }
} catch {
    if ($owned.Count -gt 0) { $owned | ConvertTo-Json | Set-Content $stateFile; Stop-Owned }
    throw
} finally { Pop-Location }
