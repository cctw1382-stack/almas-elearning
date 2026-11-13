param(
    [Parameter(Mandatory)][string]$RuntimeRoot,
    [Parameter(Mandatory)][string]$TestRoot,
    [int]$Port = 8182
)

$ErrorActionPreference = 'Stop'
$source = Join-Path $RuntimeRoot 'keycloak/keycloak-26.8.1'
$java = Get-Command java -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
if ($java) {
    $javaHome = Split-Path -Parent (Split-Path -Parent $java.Source)
} else {
    $javaHome = (Get-ChildItem (Join-Path $RuntimeRoot 'java') -Directory -ErrorAction SilentlyContinue | Select-Object -First 1).FullName
}
if (!$javaHome -or !(Test-Path (Join-Path $javaHome 'bin/java.exe')) -or !(Test-Path (Join-Path $source 'bin/kc.bat'))) { throw 'Verified local Java and Keycloak runtimes are required.' }
if (Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue) { throw 'Choose an unused fixture port.' }
$fixture = Join-Path ([IO.Path]::GetFullPath($TestRoot)) ('pkce-' + [Guid]::NewGuid().ToString('N'))
if ($fixture -notmatch '^[A-Za-z]:[\\/][A-Za-z0-9_.\\/-]+$') { throw 'Fixture path must use ASCII and no spaces.' }
New-Item -ItemType Directory -Path $fixture -Force | Out-Null
foreach ($part in @('bin', 'conf', 'lib')) {
    Copy-Item -LiteralPath (Join-Path $source $part) -Destination $fixture -Recurse
}
New-Item -ItemType Directory -Path (Join-Path $fixture 'providers') | Out-Null
$importDirectory = Join-Path $fixture 'data/import'
New-Item -ItemType Directory -Path $importDirectory -Force | Out-Null
$realmPath = Join-Path $importDirectory 'almas-local-realm.json'
$realm = Get-Content (Join-Path $PSScriptRoot 'almas-local-realm.json') -Raw | ConvertFrom-Json
$password = [Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(24))
$realm | Add-Member -NotePropertyName users -NotePropertyValue @(@{
    id = '00000000-0000-4000-8000-000000000014'
    username = 'almas-pkce-probe'
    firstName = 'Synthetic'
    lastName = 'Probe'
    email = 'almas-probe@example.invalid'
    enabled = $true
    emailVerified = $true
    credentials = @(@{ type = 'password'; value = $password; temporary = $false })
})
$hostURL = "http://127.0.0.1:$Port"
$issuer = "$hostURL/realms/almas-local"
$previousJava = $env:JAVA_HOME
$process = $null
try {
    $realm | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $realmPath -Encoding utf8
    $env:JAVA_HOME = $javaHome
    $command = (Join-Path $fixture 'bin/kc.bat') + " start-dev --db=dev-mem --http-host=127.0.0.1 --http-port=$Port --hostname=$hostURL --log-level=INFO --import-realm"
    $process = Start-Process -FilePath $env:ComSpec -ArgumentList @('/d', '/c', $command) -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $fixture 'keycloak.log') -RedirectStandardError (Join-Path $fixture 'keycloak-error.log')
    $ready = $false
    $deadline = [DateTime]::UtcNow.AddSeconds(120)
    while ([DateTime]::UtcNow -lt $deadline -and !$process.HasExited) {
        try {
            $discovery = Invoke-RestMethod "$issuer/.well-known/openid-configuration" -TimeoutSec 2
            if ($discovery.issuer -eq $issuer) { $ready = $true; break }
        } catch {}
        Start-Sleep -Seconds 1
    }
    if (!$ready) { throw "Isolated Keycloak failed to start. Logs: $fixture" }
    Remove-Item -LiteralPath $realmPath
    $env:ALMAS_OIDC_TEST_ISSUER = $issuer
    $env:ALMAS_OIDC_PROBE_PASSWORD = $password
    & node (Join-Path $PSScriptRoot '../../tests/phase3/keycloak-pkce-probe.cjs')
    if ($LASTEXITCODE -ne 0) { throw 'Isolated PKCE verification failed.' }
} finally {
    if ($process -and !$process.HasExited) { & taskkill.exe /PID $process.Id /T /F | Out-Null }
    if (Test-Path -LiteralPath $realmPath) { Remove-Item -LiteralPath $realmPath }
    $env:JAVA_HOME = $previousJava
    Remove-Item Env:ALMAS_OIDC_TEST_ISSUER -ErrorAction SilentlyContinue
    Remove-Item Env:ALMAS_OIDC_PROBE_PASSWORD -ErrorAction SilentlyContinue
}
